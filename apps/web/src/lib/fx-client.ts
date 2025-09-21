'use client';
import { fxUrl, FxResponse, FxError } from './fx-common';

export async function fetchUsdMxnClient(timeoutMs = 3000): Promise<FxResponse> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(fxUrl(), { signal: ctrl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status >= 400 && res.status < 500) throw new FxError(`Client error ${res.status}: ${text || 'Bad Request'}`, res.status);
      throw new FxError(`Server error ${res.status}: ${text || 'Upstream failure'}`, res.status);
    }
    return res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new FxError('Network timeout or connection error');
    if (e instanceof FxError) throw e;
    throw new FxError('Network error', undefined, e);
  } finally {
    clearTimeout(t);
  }
}