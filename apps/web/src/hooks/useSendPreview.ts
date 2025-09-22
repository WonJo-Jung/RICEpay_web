'use client';

import { useEffect, useMemo, useState } from 'react';
import { usdcToInt } from '../lib/fees';
import { useFeePreview } from './useFeePreview';
import { BASE_SEPOLIA } from '@ricepay/shared';
import { useAccount } from 'wagmi';

function useDebounce<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useSendPreview() {
  const [to, setTo] = useState<string>();
  const [amount, setAmount] = useState('0');

  const chainId = BASE_SEPOLIA.id;
  const { address: from } = useAccount();
  const token = process.env.NEXT_PUBLIC_USDC_ADDR as `0x${string}`;

  const amountInt = useMemo(() => usdcToInt(amount), [amount]);

  // ✅ 디바운스된 파라미터로만 호출, ms 단위
  const dAmountInt = useDebounce(amountInt, 400);
  const dTo = useDebounce(to, 300);

  const preview = useFeePreview({ chainId, from, to: dTo, token, amountInt: dAmountInt });

  return {
    // 입력 상태
    to, setTo, amount, setAmount,
    // 파생값/파라미터
    amountInt, chainId, from, token,
    // 미리보기 데이터
    preview,
  };
}