"use client";
import type { TxRecord } from "@ricepay/shared";

const EXPLORER_TX = process.env.NEXT_PUBLIC_EXPLORER!;

const styles: Record<string, React.CSSProperties> = {
  PENDING: { backgroundColor: "#fef9c3", color: "#854d0e" }, // 노랑
  CONFIRMED: { backgroundColor: "#dcfce7", color: "#166534" }, // 초록
  FAILED: { backgroundColor: "#fee2e2", color: "#991b1b" }, // 빨강
  DROPPED_REPLACED: { backgroundColor: "#f3f4f6", color: "#1f2937" }, // 회색
  EXPIRED: { backgroundColor: "#ffedd5", color: "#9a3412" }, // 주황
  UNKNOWN: { backgroundColor: "#f3f4f6", color: "#1f2937" }, // 회색
};

export default function TxStatusBadge({ tx }: { tx: TxRecord | null }) {
  if (!tx) return <span>기록 없음</span>;
  const style = styles[tx.status] ?? styles.UNKNOWN;

  return (
    <div
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.25rem 0.5rem",
        borderRadius: "0.25rem",
      }}
    >
      <span>{tx.status}</span>
      <a href={`${EXPLORER_TX}/${tx.txHash}`} target="_blank" rel="noreferrer">
        영수증
      </a>
    </div>
  );
}
