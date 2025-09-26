import type { TxRecord } from '@ricepay/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export async function registerTx(input: {
  txHash: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  token?: `0x${string}`;
  amount?: string;
  chainId: number;
}): Promise<TxRecord> {
  const res = await fetch(`${API_BASE}/tx`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to register tx: ${res.status} ${text}`);
  }
  return res.json();
}