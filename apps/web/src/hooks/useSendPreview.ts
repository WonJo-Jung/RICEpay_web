'use client';

import { useEffect, useMemo, useState } from 'react';
import { usdcToInt } from '../lib/fees';
import { useFeePreview } from './useFeePreview';
import { useAccount } from 'wagmi';
import { isAddress } from 'viem';

function useDebounce<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useSendPreview() {
  const [to, setTo] = useState<string>('받는 주소(0x...)');
  const [amount, setAmount] = useState('보낼 금액 (USDC)');
  const { chainId } = useAccount();

  const { address: from } = useAccount();
  const connected = !!from;
  const token = process.env.NEXT_PUBLIC_USDC_ADDR as `0x${string}`;

  const amountInt = useMemo(() => usdcToInt(amount), [amount]);

  // ✅ 디바운스된 파라미터로만 호출, ms 단위
  const dAmountInt = useDebounce(amountInt, 400);
  const dTo = useDebounce(to, 300);

  const preview = useFeePreview({ chainId, from, to: dTo, token, amountInt: dAmountInt });

  // 화면에서 쉽게 분기할 수 있도록 상태 플래그 제공
  const reason =
    !connected ? 'noWallet'
    : !isAddress(to) ? 'badAddress'
    : amountInt === '0' ? 'zeroAmount'
    : null;

  return {
    // 입력 상태
    to, setTo, amount, setAmount,
    // 파생값/파라미터
    amountInt, chainId, from, token,
    // 미리보기 데이터
    preview,
    // UX 분기용 상태
    connected,
    reason, // 'noWallet' | 'badAddress' | 'zeroAmount' | null
  };
}