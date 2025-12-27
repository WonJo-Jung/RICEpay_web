"use client";

import useSWR from "swr";
import { fetchUsdMxnClient } from "../lib/fx-client";
import { fxTtlSeconds } from "../lib/config";
import { formatDateTime, formatRelative } from "../lib/datetime";
import { FxError, FxResponse } from "../lib/fx-common";

type Props = {
  initialData: FxResponse | null;
};

export default function FxCard({ initialData }: Props) {
  const { data, error, isValidating, mutate } = useSWR<FxResponse, FxError>(
    "/fx/usd-mxn",
    () => fetchUsdMxnClient(),
    {
      // TTL을 백엔드 응답값(우선) → .env 헬퍼(대체) 순으로 동기화
      refreshInterval: (d?: FxResponse) =>
        (d?.ttlSeconds ?? fxTtlSeconds) * 1000,
      fallbackData: initialData ?? undefined,
      revalidateOnFocus: true,
    }
  );

  // 로딩/스켈레톤
  if (!data && !error) {
    return (
      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
        <div className="h-7 w-32 bg-gray-200 rounded" />
        <div className="mt-3 h-4 w-40 bg-gray-100 rounded" />
      </div>
    );
  }

  // 에러 카드 (네트워크 / 4xx / 5xx 구분)
  if (error) {
    const kind =
      error.status == null
        ? "Network"
        : error.status >= 500
          ? "Server"
          : "Client";
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
        <div className="font-semibold">FX Error ({kind})</div>
        <div className="text-sm mt-1">{error.message}</div>
        <button
          onClick={() => mutate()}
          className="mt-3 inline-flex items-center rounded-lg border px-3 py-1.5 text-sm"
        >
          ↻ Try again
        </button>
      </div>
    );
  }

  // 정상 표시
  const d = data!;
  const asOfLocal = formatDateTime(d.asOf);
  const asOfRel = formatRelative(d.asOf);

  // 통화 포맷 (보기 좋게 4자리 고정)
  const rateText = new Intl.NumberFormat(
    typeof navigator !== "undefined" ? navigator.language : "en-US",
    { minimumFractionDigits: 4, maximumFractionDigits: 4 }
  ).format(d.rate);

  return (
    <div className="rounded-2xl border p-4 shadow-sm flex items-start justify-between">
      <div>
        <div className="text-sm text-gray-500">USD → MXN</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          {rateText}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          as of {asOfLocal} ({asOfRel}) · source: {d.source}
        </div>
        <div className="mt-1 text-[11px] text-gray-400">{d.disclaimer}</div>
      </div>

      <div className="flex flex-col items-end gap-2">
        {/* 작은 느낌표(⚠︎) stale 배지 */}
        {d.stale && (
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px]">
            ⚠︎ stale
          </span>
        )}
        <button
          onClick={() => mutate()}
          disabled={isValidating}
          aria-busy={isValidating}
          className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm disabled:opacity-60"
          title="Refresh now"
        >
          {isValidating ? "Updating…" : "↻ Refresh"}
        </button>
        <span className="text-[11px] text-gray-400">
          auto: {(d.ttlSeconds ?? fxTtlSeconds) / 3600}h
        </span>
      </div>
    </div>
  );
}
