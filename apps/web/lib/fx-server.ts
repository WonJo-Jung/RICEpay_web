import { fxUrl, FxResponse } from './fx-common';
import { fxTtlSeconds } from './config';

export async function fetchUsdMxnServer(timeoutMs = 3000): Promise<FxResponse | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(fxUrl(), { next: { revalidate: fxTtlSeconds }, signal: ctrl.signal });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}