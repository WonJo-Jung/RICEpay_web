import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../lib/api';

export type ReceiptItem = {
  id: string;
  chainId: number;
  network: string;
  txHash: string;
  direction: 'SENT' | 'RECEIVED'; // 서버 값(현재 SENT 위주) — 없으면 클라에서 계산 fallback 가능
  token: string;
  amount: string;
  fiatCurrency: string;
  fiatRate: string;
  fiatAmount: string;
  gasPaid?: string | null;
  gasFiatAmount?: string | null;
  appFee?: string | null;
  appFeeFiat?: string | null;
  policyVersion: string;
  fromAddress: string;
  toAddress: string;
  submittedAt: string;
  confirmedAt: string;
};

type ActivityResp = { items: ReceiptItem[]; nextCursor: string | null };

export function useActivity(params: {
  address?: string; // 내 주소 있으면 toAddress 매칭으로 RECEIVED 계산
  chainId?: number;
  direction?: 'SENT' | 'RECEIVED'; // 서버 필터 or 클라 필터
  from?: string;
  to?: string;
  pageSize?: number;
}) {
  const { address, chainId, direction, from, to, pageSize = 20 } = params;
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [eof, setEof] = useState(false);
  const firstLoad = useRef(true);

  const query = useMemo(() => ({
    address, chainId, direction, from, to, limit: pageSize,
  }), [address, chainId, direction, from, to, pageSize]);

  async function load(reset = false) {
    if (loading) return;
    if (!reset && (eof || (firstLoad.current === false && next === null))) return;
    setLoading(true);
    try {
      const res = await apiGet<ActivityResp>('activity', {
        searchParams: { ...query, cursor: reset ? undefined : next ?? undefined },
      });
      if (reset) {
        setItems(res.items);
      } else {
        setItems(prev => [...prev, ...res.items]);
      }
      setNext(res.nextCursor);
      setEof(!res.nextCursor);
      firstLoad.current = false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 파라미터 바뀌면 리셋 로드
    setItems([]);
    setNext(null);
    setEof(false);
    firstLoad.current = true;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  return { items, loading, eof, loadMore: () => load(false) };
}