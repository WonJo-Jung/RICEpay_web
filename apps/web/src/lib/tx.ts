import { ComplianceErrorBody, TxRecord } from "@ricepay/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
const PREFIX = process.env.NEXT_PUBLIC_GLOBAL_PREFIX!;

export async function txPost<T>(path: string, input: any) {
  const res = await fetch(`${API_BASE}/${PREFIX}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...devGeoHeaders() },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, ok: res.ok, data } as { status: number; ok: boolean; data: T };
}

export type ComplianceResult = 
  | { kind: "success"; record: TxRecord, msg: string }
  | { kind: "error"; status: number; data: ComplianceErrorBody, msg: string }
  | null

export type TransferResult = {
  hash: `0x${string}`, compliance: ComplianceResult
} | {
  hash?: `0x${string}`, compliance: ComplianceResult
}

function devGeoHeaders(country = "KR", region = ""): Record<string, string> {
  // NEXT_PUBLIC_DEV_GEO_OVERRIDE=true 일 때만 오버라이드 활성화
  if (process.env.NEXT_PUBLIC_DEV_GEO_OVERRIDE !== "true") return {};

  const headers: Record<string, string> = {};
  if (country) headers["cf-ipcountry"] = country.toUpperCase();
  if (region) headers["cf-region"] = region;

  // 디버깅용 로그 (개발 환경에서만)
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.debug("[txPost] Dev geo headers →", headers);
  }

  return headers;
}