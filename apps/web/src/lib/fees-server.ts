export type FeePreviewParams = {
  chainId: number;
  from: `0x${string}` | string;
  to: `0x${string}` | string;
  token: `0x${string}` | string;
  amountInt: string; // USDC 6dec 정수 문자열
};

export type FeePreviewResponse = {
    chainId: string;
    token: string;
    decimals: number;
    amount: string;
    riceFee: {
      usd: string;
      token: string;
      policy: { pct: number; minUsd: number; maxUsd: number; };
    };
    gas: {
      limit: string;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
      native: string;
      nativeSymbol: string;
      usd: string;
      bufferedUsd: string;
    };
    totals: {
      payerPays: {
        token: string;
        gasNative: string;
      };
      receiverGets: {
        token: string;
      };
    };
    quotes: {
      nativeUsd: string;
      usdcUsd: string;
      at: string;
      source: string;
    };
    meta: {
      confidence: string;
      reestimateHint: boolean;
      networkName: string;
    };
};

const PREFIX = process.env.NEXT_PUBLIC_GLOBAL_PREFIX!;
const API_BASE = typeof window === 'undefined'
  ? '' // SSR/빌드에서는 절대 URL 사용 지양 → Next 라우트 핸들러나 상대경로
  : (process.env.NEXT_PUBLIC_API_BASE_URL ? process.env.NEXT_PUBLIC_API_BASE_URL + "/" + PREFIX : '').replace(/\/+$/, '');

export async function previewFees(p: FeePreviewParams): Promise<FeePreviewResponse> {
  const qs = new URLSearchParams({
    chainId: String(p.chainId),
    from: String(p.from),
    to: String(p.to),
    token: String(p.token),
    amount: p.amountInt,
  }).toString();

  const url = `${API_BASE || ''}/fees/preview?${qs}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`fee preview failed: ${res.status} ${t}`);
  }
  return res.json();
}