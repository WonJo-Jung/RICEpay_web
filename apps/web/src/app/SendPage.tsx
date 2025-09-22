"use client";

import { useSendPreview } from "../hooks/useSendPreview";
import { FeePreviewCard } from "../components/FeePreviewCard";

export default function SendPage() {
  const { to, setTo, amount, setAmount, amountInt, preview } = useSendPreview();

  return (
    <div>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="받는 주소 (0x…)"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="보낼 금액 (USDC)"
      />
      <div style={{ fontSize: 12, opacity: 0.7 }}>amountInt: {amountInt}</div>

      {preview.isFetching && <div>미리보기 계산 중…</div>}
      {preview.error && (
        <div style={{ color: "crimson" }}>
          에러: {(preview.error as Error).message}
        </div>
      )}
      {preview.data && <FeePreviewCard data={preview.data} />}
    </div>
  );
}
