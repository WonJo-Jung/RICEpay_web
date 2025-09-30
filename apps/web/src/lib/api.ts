// 공통 API 클라이언트
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

type FetchInit = RequestInit & { searchParams?: Record<string, string | number | undefined | null> };

function buildURL(path: string, search?: FetchInit['searchParams']) {
  const url = new URL(path.replace(/^\//, ''), API_BASE_URL.endsWith('/') ? API_BASE_URL : API_BASE_URL + '/');
  if (search) {
    Object.entries(search).forEach(([k, v]) => {
      if (v !== undefined && v !== null && `${v}`.length > 0) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

export async function apiGet<T>(path: string, init?: FetchInit): Promise<T> {
  const url = buildURL(path, init?.searchParams);
  const res = await fetch(url, {
    ...init,
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${url} ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const url = buildURL(path);
  const res = await fetch(url, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${url} ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}