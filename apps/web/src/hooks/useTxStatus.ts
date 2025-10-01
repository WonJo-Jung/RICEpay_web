// apps/web/src/hooks/useTxStatus.ts
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TxRecord } from '@ricepay/shared';

type Options = {
  /** SSE 사용 여부 (기본 true) */
  sse?: boolean;
  /** 폴링 간격(ms). SSE 실패/부재 시 사용. (기본 10000ms) */
  pollMs?: number;
  /** 단건 조회 최소 간격(ms). (기본 8000ms) */
  minIntervalMs?: number;
  /** 터미널 도달 시(SUCCESS/FAILED/EXPIRED/DR) 자동 정지 (기본 true) */
  stopOnTerminal?: boolean;
  /** onConfirmed 트리거 최소 컨펌(기본 1) — UI엔 노출 안 해도 됨 */
  minConfirmations?: number;
  /** (선택) 상태 콜백들 — 최초 1회만 fire */
  onConfirmed?: (rec: TxRecord) => void;
  onFailed?: (rec: TxRecord) => void;
  onExpired?: (rec: TxRecord) => void;
  onDroppedReplaced?: (rec: TxRecord) => void;
  onTerminal?: (rec: TxRecord) => void;
  onAnyUpdate?: (rec: TxRecord) => void;
  /** (선택) 전체 타임아웃(ms) — 초과 시 정지 */
  timeoutMs?: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
const PREFIX = process.env.NEXT_PUBLIC_GLOBAL_PREFIX!;
const isTerminal = (s?: TxRecord['status']) =>
  s === 'CONFIRMED' || s === 'FAILED' || s === 'EXPIRED' || s === 'DROPPED_REPLACED';

export function useTxStatus(hash?: `0x${string}`, opts: Options = {}) {
  const {
    sse = true,
    pollMs = 10000,
    minIntervalMs = 8000,
    stopOnTerminal = true,
    minConfirmations = 1,
    onConfirmed, onFailed, onExpired, onDroppedReplaced, onTerminal, onAnyUpdate,
    timeoutMs,
  } = opts;

  const [record, setRecord] = useState<TxRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<unknown>(null);

  const lowerHash = useMemo(() => (hash ? (hash as string).toLowerCase() : undefined), [hash]);

  // ===== 콜백/옵션을 ref에 저장(의존성 안정화) =====
  const cbRef = useRef({
    minConfirmations, stopOnTerminal,
    onConfirmed, onFailed, onExpired, onDroppedReplaced, onTerminal, onAnyUpdate,
  });
  useEffect(() => {
    cbRef.current = { minConfirmations, stopOnTerminal, onConfirmed, onFailed, onExpired, onDroppedReplaced, onTerminal, onAnyUpdate };
  }, [minConfirmations, stopOnTerminal, onConfirmed, onFailed, onExpired, onDroppedReplaced, onTerminal, onAnyUpdate]);

  // ===== 내부 상태/리소스 =====
  const lastJsonStr      = useRef<string>('');
  const sseRef           = useRef<EventSource | null>(null);
  const sseOpenRef       = useRef<boolean>(false);
  const pollTimer        = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef         = useRef<AbortController | null>(null);

  // 네트워크 호출 제어
  const inFlightRef      = useRef(false);
  const nextAllowedAtRef = useRef(0);
  const backoffUntilRef  = useRef(0);
  const lastErrMsgRef    = useRef<string | null>(null);

  const now = () => Date.now();

  const cleanupTimers = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };
  const closeSSE = () => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    sseOpenRef.current = false;
  };

  // ===== 콜백 트리거(최초 1회씩) =====
  const confirmedCalled = useRef(false);
  const failedCalled    = useRef(false);
  const expiredCalled   = useRef(false);
  const droppedCalled   = useRef(false);
  const terminalCalled  = useRef(false);
  const anyUpdateCalled = useRef(false);

  const fireCallbacksIfNeeded = (rec: TxRecord) => {
    const { minConfirmations, stopOnTerminal, onAnyUpdate, onConfirmed, onFailed, onExpired, onDroppedReplaced, onTerminal } = cbRef.current;

    if (!anyUpdateCalled.current) { anyUpdateCalled.current = true; onAnyUpdate?.(rec); }

    const conf = rec.confirmations ?? 1;
    if (rec.status === 'CONFIRMED' && conf >= minConfirmations && !confirmedCalled.current) {
      confirmedCalled.current = true; onConfirmed?.(rec);
    }
    if (rec.status === 'FAILED' && !failedCalled.current) {
      failedCalled.current = true; onFailed?.(rec);
    }
    if (rec.status === 'EXPIRED' && !expiredCalled.current) {
      expiredCalled.current = true; onExpired?.(rec);
    }
    if (rec.status === 'DROPPED_REPLACED' && !droppedCalled.current) {
      droppedCalled.current = true; onDroppedReplaced?.(rec);
    }
    if (isTerminal(rec.status) && !terminalCalled.current) {
      terminalCalled.current = true; onTerminal?.(rec);
    }
    if (stopOnTerminal && isTerminal(rec.status)) {
      cleanupTimers(); closeSSE();
    }
  };

  // ===== 단건 조회(fetchOnce): 최소간격/동시요청락/Abort/백오프/에러디듀프 =====
  async function fetchOnce(signal?: AbortSignal) {
    if (!lowerHash) { setRecord(null); return; }
    if (document.visibilityState === 'hidden') return;

    const t = now();
    if (t < backoffUntilRef.current) return;
    if (t < nextAllowedAtRef.current) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    nextAllowedAtRef.current = t + minIntervalMs;

    // 이전 요청 취소
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/${PREFIX}/tx?hash=${lowerHash}`, { cache: 'no-store', signal: signal ?? ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as TxRecord | null;
      if (!data) return;

      const json = JSON.stringify(data);
      if (json !== lastJsonStr.current) {
        lastJsonStr.current = json;
        setRecord(data);
        fireCallbacksIfNeeded(data);
      }
      backoffUntilRef.current = 0; // 성공 → 백오프 해제
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (lastErrMsgRef.current !== msg) {
        lastErrMsgRef.current = msg;
        setError(e); // 같은 에러 반복 setState 방지
      }
      backoffUntilRef.current = now() + 3000; // 3s 백오프
    } finally {
      inFlightRef.current = false;
    }
  }

  // ===== 초기/해시 변경 시 1회 조회 + (선택) 타임아웃 =====
  useEffect(() => {
    // 플래그 리셋
    confirmedCalled.current = false;
    failedCalled.current    = false;
    expiredCalled.current   = false;
    droppedCalled.current   = false;
    terminalCalled.current  = false;
    anyUpdateCalled.current = false;
    lastErrMsgRef.current   = null;

    cleanupTimers(); closeSSE();
    backoffUntilRef.current  = 0;
    nextAllowedAtRef.current = 0;
    inFlightRef.current      = false;

    setError(null);
    if (!lowerHash) { setRecord(null); setLoading(false); return; }

    setLoading(true);
    const ctrl = new AbortController();
    fetchOnce(ctrl.signal)
      .catch((e) => setError(e))
      .finally(() => setLoading(false));

    if (timeoutMs && timeoutMs > 0) {
      const timer = setTimeout(() => {
        if (!isTerminal(record?.status)) {
          if (lastErrMsgRef.current !== 'Transaction status timeout') {
            lastErrMsgRef.current = 'Transaction status timeout';
            setError(new Error('Transaction status timeout'));
          }
          cleanupTimers(); closeSSE();
        }
      }, timeoutMs);
      timeoutRef.current = timer;
    }

    return () => { ctrl.abort(); };
    // lowerHash/timeoutMs만 의존 (다른 함수/상태는 ref에서 읽음)
  }, [lowerHash, timeoutMs]); // ✅ 의존성 다이어트

  // ===== 폴링( SseOpen이면 자동 멈춤 ) =====
  const startPolling = () => {
    if (pollTimer.current) return;
    const tick = () => {
      if (sseOpenRef.current) return;
      fetchOnce().catch(() => void 0);
    };
    tick();
    pollTimer.current = setInterval(tick, pollMs);
  };

  // ===== SSE + 재연결(간단 백오프) + 폴링 백업 =====
  const startSSE = () => {
    if (document.visibilityState === 'hidden') { startPolling(); return; }
    closeSSE();

    const es = new EventSource(`${API_BASE}/${PREFIX}/tx/stream`);
    sseRef.current = es;

    let lastEmit = 0; // 디바운스(선택)
    const DEBOUNCE = 2000; // 필요하면 2000 등으로 조정

    es.onopen = () => {
      sseOpenRef.current = true;
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    };

    es.onmessage = (ev) => {
      if (!ev?.data || !lowerHash) return;
      const nowTs = now();
      if (DEBOUNCE && nowTs - lastEmit < DEBOUNCE) return;
      try {
        const data = JSON.parse(ev.data) as TxRecord;
        if (data.txHash?.toLowerCase() !== lowerHash) return;

        const json = JSON.stringify(data);
        if (json !== lastJsonStr.current) {
          lastJsonStr.current = json;
          setRecord(data);
          fireCallbacksIfNeeded(data);
          lastEmit = nowTs;
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      sseOpenRef.current = false;
      startPolling();
      // 간단 지수 백오프(최대 30s) — 여기선 setTimeout으로 재시도만
      const delay = Math.min(30000, (backoffUntilRef.current ? backoffUntilRef.current - now() : 1000));
      setTimeout(() => {
        if (document.visibilityState === 'visible') startSSE();
      }, Math.max(1000, delay));
    };
  };

  // ===== 오케스트레이션 =====
  useEffect(() => {
    if (!lowerHash) return;
    closeSSE(); cleanupTimers();

    if (sse) startSSE();
    else startPolling();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchOnce().catch(() => void 0);
        if (sse) startSSE();
      } else {
        // hidden이면 폴링 유지하되 fetchOnce 내부에서 스킵됨
        sseOpenRef.current = false;
      }
    };
    const onOnline = () => { fetchOnce().catch(() => void 0); if (sse) startSSE(); };
    const onOffline = () => { sseOpenRef.current = false; };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      closeSSE(); cleanupTimers();
    };
  }, [lowerHash, sse, pollMs, minIntervalMs]);

  return { record, loading, error };
}