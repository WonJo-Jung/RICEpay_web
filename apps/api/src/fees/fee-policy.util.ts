const ONE = (d: number) => BigInt(10) ** BigInt(d);

export type FeePolicy = { pct: number; minUsd: number; maxUsd: number; };

export const readPolicy = (): FeePolicy => ({
  pct: Number(process.env.RICE_FEE_PCT ?? 0.0039),
  minUsd: Number(process.env.RICE_FEE_MIN_USD ?? 0.25),
  maxUsd: Number(process.env.RICE_FEE_MAX_USD ?? 3.90),
});

export const calcFeeUsd = (sendUsd: number, p: FeePolicy) =>
  Math.min(Math.max(sendUsd * p.pct, p.minUsd), p.maxUsd);

// USD → 토큰 정수(ceil)
export const usdToTokenIntCeil = (feeUsd: number, decimals: number): bigint =>
  BigInt(Math.ceil(feeUsd * Number(ONE(decimals))));

// 토큰 정수 → USD
export const tokenIntToUsd = (amountInt: bigint, tokenUsd: number, decimals: number) =>
  (Number(amountInt) / Number(ONE(decimals))) * tokenUsd;