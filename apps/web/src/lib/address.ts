// ENS 연동은 나중에 원하면 추가
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
const PREFIX = process.env.NEXT_PUBLIC_GLOBAL_PREFIX!;

export function shortAddr(addr?: string, left = 6, right = 4) {
  if (!addr) return '';
  if (addr.length <= left + right) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

export async function getNonce() {
  const res = await fetch(`${API_BASE}/${PREFIX}/auth/nonce`, { method: 'POST' });
  if (!res.ok) throw new Error('nonce failed');
  return res.json() as Promise<{ nonce: string; exp: number }>;
}