import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';

export type Receipt = {
  id: string;
  transactionId: string;
  chainId: number;
  network: string;
  txHash: string;
  direction: 'SENT' | 'RECEIVED';
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
  shareToken?: string | null;
};

export function useReceiptById(id?: string) {
  const [data, setData] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGet<Receipt>(`receipts/${id}`)
      .then(setData)
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}

export function useReceiptByShareToken(token?: string) {
  const [data, setData] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiGet<Receipt>(`receipts/share/${token}`)
      .then(setData)
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [token]);

  return { data, loading, error };
}