/** USDC(6 decimals) → 정수 문자열 */
export function usdcToInt(human: string): string {
  const v = Number(human?.trim() || 0);
  if (!isFinite(v) || v <= 0) return '0';
  return String(Math.round(v * 1e6));
}

/** 정수 문자열 → USDC(6 decimals) (표시용) */
export function intToUsdc(intStr: string): string {
  const n = Number(intStr || 0);
  return (n / 1e6).toFixed(6).replace(/\.?0+$/, '');
}