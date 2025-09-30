"use client";

import { useMemo } from "react";
import { useActivity } from "../hooks/useActivity";
import { computeDirection } from "../lib/direction";
import { shortAddr } from "../lib/address";
import { formatDateTime } from "../lib/datetime"; // 기존 datetime 유틸 사용 가정

export default function ActivityList({
  myAddresses,
}: {
  myAddresses?: string[];
}) {
  const { items, loading, eof, loadMore } = useActivity({ pageSize: 20 });

  const rows = useMemo(() => {
    return items.map((it) => {
      const dir = computeDirection(
        myAddresses ?? null,
        it.fromAddress,
        it.toAddress
      );
      return { ...it, _dir: dir };
    });
  }, [items, myAddresses]);

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex flex-col">
            <span
              className={`text-sm font-medium ${r._dir === "SENT" ? "text-red-600" : "text-green-600"}`}
            >
              {r._dir === "SENT" ? "보냄" : "받음"} · {r.token} {r.amount}
            </span>
            <span className="text-xs text-gray-500">
              {shortAddr(r.fromAddress)} → {shortAddr(r.toAddress)} ·{" "}
              {formatDateTime(r.confirmedAt)}
            </span>
          </div>
          <a
            href={`/receipts/${r.id}`}
            className="text-xs underline hover:no-underline"
          >
            영수증
          </a>
        </div>
      ))}

      <div className="py-3">
        {loading ? (
          <span className="text-sm text-gray-500">로딩 중…</span>
        ) : !eof ? (
          <button className="text-sm underline" onClick={loadMore}>
            더 보기
          </button>
        ) : (
          <span className="text-sm text-gray-400">마지막입니다</span>
        )}
      </div>
    </div>
  );
}
