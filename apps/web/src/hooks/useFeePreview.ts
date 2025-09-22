'use client';

import { useQuery } from '@tanstack/react-query';
import { previewFees, type FeePreviewParams, type FeePreviewResponse } from '../lib/fees-server';

export function useFeePreview(params: FeePreviewParams) {
  // 브라우저에서만 쿼리 활성화 + 파라미터 유효성 가드
  const isBrowser = typeof window !== 'undefined';
  const enabled =
    isBrowser &&
    !!params?.to &&
    !!params?.token &&
    params?.amountInt !== '0' &&
    Number.isFinite(params?.chainId);

  return useQuery<FeePreviewResponse>({
    queryKey: ['fees/preview', params],
    queryFn: () => previewFees(params),
    enabled,
    // ✅ 실서비스 권장값
    staleTime: 15_000,                // 15s 동안은 refetch 스킵
    refetchOnWindowFocus: true,       // focus 시 stale일 때만 refetch
    refetchOnReconnect: true,
    retry: 1,
    gcTime: 60_000,                   // (선택) 캐시 보존시간
  });
}