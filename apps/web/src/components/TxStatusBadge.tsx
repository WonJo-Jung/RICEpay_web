"use client";
import type { TxRecord } from "@ricepay/shared";

const EXPLORER_TX = process.env.NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER!;

export default function TxStatusBadge({ tx }: { tx: TxRecord | null }) {
  if (!tx) return <span>기록 없음</span>;
  const cls = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    DROPPED_REPLACED: "bg-gray-100 text-gray-800",
    UNKNOWN: "bg-gray-100 text-gray-800",
  }[tx.status];

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded ${cls}`}>
      <span>{tx.status}</span>
      <a href={`${EXPLORER_TX}/${tx.txHash}`} target="_blank" rel="noreferrer">
        영수증
      </a>
    </div>
  );
}
