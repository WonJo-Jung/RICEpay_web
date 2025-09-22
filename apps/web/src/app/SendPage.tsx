"use client";

import { useSendPreview } from "../hooks/useSendPreview";
import { FeePreviewCard } from "../components/FeePreviewCard";

export default function SendPage() {
  const { to, setTo, amount, setAmount, preview, connected, reason } =
    useSendPreview();

  return (
    <div>
      {!connected && <div style={{ color: "#555" }}>지갑을 연결해 주세요.</div>}
      <div>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="받는 주소 (0x…)"
          disabled={!connected}
        />
        {reason === "badAddress" && (
          <span style={{ color: "#b45309" }}>
            받는 주소를 올바르게 입력하세요 (0x...)
          </span>
        )}
      </div>
      <div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="보낼 금액 (USDC)"
          disabled={!connected}
        />
        {reason === "zeroAmount" && (
          <span style={{ color: "#b45309" }}>보낼 금액을 입력하세요.</span>
        )}
      </div>

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
