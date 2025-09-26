// apps/web/src/hooks/useTxStatus.ts
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TxRecord } from '@ricepay/shared';

type Options = {
  /** SSE 사용 여부 (기본 true) */
  sse?: boolean;
  /** 폴링 간격(ms). SSE 실패/부재 시 사용. (기본 5000ms) */
  pollMs?: number;
  /** 확인 수 임계치 등 추가 로직이 필요하면 옵션으로 확장 */
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export function useTxStatus(hash?: `0x${string}`, opts: Options = {}) {
  const { sse = true, pollMs = 5000 } = opts;

  const [record, setRecord] = useState<TxRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<unknown>(null);

  const lowerHash = useMemo(() => (hash ? (hash as string).toLowerCase() : undefined), [hash]);
  const lastJsonStr = useRef<string>(''); // 동일 데이터 중복 setState 방지
  const sseRef = useRef<EventSource | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 공통 단건 조회 함수
  async function fetchOnce(signal?: AbortSignal) {
    if (!lowerHash) { setRecord(null); return; }
    const url = `${API_BASE}/tx?hash=${lowerHash}`;
    const res = await fetch(url, { cache: 'no-store', signal });
    if (!res.ok) return;
    const data = (await res.json()) as TxRecord;
    const json = JSON.stringify(data);
    if (json !== lastJsonStr.current) {
      lastJsonStr.current = json;
      setRecord(data);
    }
  }

  // 초기/해시 변경 시 한 번 조회
  useEffect(() => {
    let aborted = false;
    setError(null);
    if (!lowerHash) { setRecord(null); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    fetchOnce(ctrl.signal)
      .catch((e) => !aborted && setError(e))
      .finally(() => !aborted && setLoading(false));
    return () => { aborted = true; ctrl.abort(); };
  }, [lowerHash]);

  // SSE 구독 + 폴링 백업
  useEffect(() => {
    // 해시가 없으면 아무 것도 안 함
    if (!lowerHash) return;

    // 클린업 함수
    const cleanup = () => {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    };
    cleanup(); // 중복 방지

    // 폴링 시작 함수
    const startPolling = () => {
      if (pollTimer.current) return;
      pollTimer.current = setInterval(() => {
        // 탭이 비활성화면 과한 호출 방지
        if (document.visibilityState === 'hidden') return;
        fetchOnce().catch((e) => setError(e));
      }, pollMs);
    };

    if (sse) {
      // 1) SSE 먼저 시도
      const es = new EventSource(`${API_BASE}/tx/stream`);
      sseRef.current = es;

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as TxRecord;
          if (data.txHash?.toLowerCase() === lowerHash) {
            const json = JSON.stringify(data);
            if (json !== lastJsonStr.current) {
              lastJsonStr.current = json;
              setRecord(data);
            }
          }
        } catch (e) {
          // 파싱 실패는 무시하고 폴링 백업이 보완
        }
      };

      es.onerror = () => {
        // SSE가 끊기면 폴링으로 백업
        startPolling();
      };

      // 가끔 서버/프록시가 idle로 끊을 수 있으므로, 가벼운 keep-alive 폴링도 괜찮음(선택)
      // setInterval(() => es.readyState === 2 && startPolling(), 15000);
    } else {
      // 2) SSE 비활성화면 폴링만
      startPolling();
    }

    // 페이지가 백그라운드에서 다시 활성화될 때 한 번 즉시 동기화
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchOnce().catch(() => void 0);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cleanup();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [lowerHash, sse, pollMs]);

  return { record, loading, error };
}