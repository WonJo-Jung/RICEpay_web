"use client";

import * as React from "react";
import { FxResponse } from "../lib/fx-common";
import { fetchUsdMxnClient } from "../lib/fx-client";

export default function FxBadge() {
  const [data, setData] = React.useState<FxResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    fetchUsdMxnClient()
      .then((d) => {
        if (mounted) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <span className="inline-flex items-center rounded-xl px-3 py-1 text-sm bg-gray-100">
        Loading FX…
      </span>
    );
  }
  if (error || !data) {
    return (
      <span className="inline-flex items-center rounded-xl px-3 py-1 text-sm bg-red-100 text-red-700">
        FX error
      </span>
    );
  }

  const asOfLocal = new Date(data.asOf).toLocaleString();

  // 요구사항: stale 표시는 현재는 안 쓰기로 했으니 표시 안 함
  return (
    <div className="inline-flex items-center gap-2 rounded-xl px-3 py-1 text-sm bg-gray-100">
      <span>USD→MXN</span>
      <strong>{data.rate.toFixed(4)}</strong>
      <span className="text-gray-500">as of {asOfLocal}</span>
      <span>from {data.source}</span>
      <div>disclaimer: {data.disclaimer}</div>
    </div>
  );
}
