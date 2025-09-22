"use client";

import type { FeePreviewResponse } from "../lib/fees-server";
import { intToUsdc } from "../lib/fees";

export function FeePreviewCard({ data }: { data: FeePreviewResponse }) {
  const { amount, riceFee, gas, totals } = data;

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        수수료·가스비 미리보기
      </div>

      <div>보내는 금액 (USDC): {intToUsdc(amount)}</div>

      <div>
        수수료: {intToUsdc(riceFee.token)} USDC (~${riceFee.usd})
      </div>

      <div>
        가스비: {gas.native} {gas.nativeSymbol} (~${gas.usd})
      </div>

      <div>수취 금액 (USDC): {intToUsdc(totals.receiverGets.token)}</div>

      <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
        정책: {riceFee.policy.pct * 100}% / ${riceFee.policy.minUsd.toFixed(2)}{" "}
        최소 / ${riceFee.policy.maxUsd.toFixed(2)} 상한
      </div>
    </div>
  );
}
