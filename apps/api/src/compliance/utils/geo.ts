/**
 * Geolocation utilities (Cloudflare → ipregistry)
 * 1) Cloudflare 헤더(CF-IPCountry 등) 최우선
 * 2) ipregistry API 조회 (fallback, 상업적 사용 가능 + VPN/Proxy/Tor/DC 포함)
 * 3) 간단 메모리 캐시로 성능/비용 보강
 *
 * ENV:
 *   IPREGISTRY_API_KEY=your_key_here             (필수)
 *   CF_HEADER_COUNTRY=cf-ipcountry               (선택)
 *   CF_HEADER_REGION=cf-region                   (선택)
 *   IPREGISTRY_CACHE_TTL_S=600                   (선택) 10분
 *   IPREGISTRY_TIMEOUT_MS=2000                   (선택) 2초
 *   ALLOW_DEV_HEADERS=true                       (선택) 로컬에서 헤더 오버라이드 허용
 *
 * 의존: Node 18+ (글로벌 fetch 사용) / 별도 패키지 불필요
 */

import { ApiResponse, IpInfo, IpregistryClient, IpregistryOptions } from "@ipregistry/client";

export type GeoResult = { country?: string | null; region?: string | null };

export type ThreatSignals = {
  // ipregistry security
  isVpn?: boolean;
  isProxy?: boolean;
  isTor?: boolean;
  isCloudProvider?: boolean;
  isAnonymous?: boolean;
  isThreat?: boolean;
  isAttacker?: boolean;
  isAbuser?: boolean;
  isBogon?: boolean;
  isRelay?: boolean;
  asn?: number;
  asOrg?: string;
  asType?: string; // 'isp' | 'business' | 'hosting' 등

  // Cloudflare signals
  cfThreatScore?: number; // 0~100 (높을수록 위험)
  cfBotScore?: number;    // 1~99 (낮을수록 위험)
};

export type GeoThreatResult = GeoResult & ThreatSignals;

// ---------- 공통 유틸 ----------
function normalizeHeaderKeys(headers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers || {})) out[k.toLowerCase()] = v;
  return out;
}
function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return undefined;
}
function asNumber(v: unknown): number | undefined {
  const s = asString(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// ---------- 1) Cloudflare 헤더 파싱 ----------
/**
 * Cloudflare 프록시 뒤라면 'CF-IPCountry' 등 헤더가 옴.
 * (선택) Workers 등에서 region/city를 커스텀 헤더로 넣었다면 opts로 지정 가능.
 *
 * 로컬 개발 시, ALLOW_DEV_HEADERS=true 이면 프론트에서 cf-ipcountry / cf-region 헤더를
 * 수동 주입하여 테스트 가능.
 */
export function extractGeoFromHeaders(
  headers: Record<string, unknown>,
  opts?: { countryHeader?: string; regionHeader?: string }
): GeoResult {
  const h2 = normalizeHeaderKeys(headers);
  console.log(h2);

  // 기본 헤더 키
  const countryKey = (opts?.countryHeader || process.env.CF_HEADER_COUNTRY || 'cf-ipcountry').toLowerCase();
  const regionKey = (opts?.regionHeader || process.env.CF_HEADER_REGION || 'cf-region').toLowerCase();

  // Cloudflare 기준
  const cfCountry = asString(h2[countryKey])?.toUpperCase();
  const cfRegion = asString(h2[regionKey]);

  // Cloudflare 통과 여부 추정 (대표 헤더)
  const fromCloudflare =
    !!h2['cf-ray'] || !!h2['cf-connecting-ip'] || !!h2['cdn-loop'];

  // 개발용 오버라이드 플래그
  const allowDev = process.env.ALLOW_DEV_HEADERS === 'true';

  // 호스트 기반 로컬 개발 보조 판단
  const host = asString(h2['host']) || '';
  const isLocalHost =
    host.includes('localhost') ||
    host.startsWith('127.') ||
    host.includes('.local') ||
    host.includes('192.168.') ||
    host.includes('10.');

  // 최종 선택 로직
  if (fromCloudflare) {
    // Cloudflare 환경 → 신뢰하고 그대로 사용
    return {
      country: cfCountry || undefined,
      region: cfRegion || undefined,
    };
  }

  if (allowDev && isLocalHost) {
    // 로컬 개발 환경 → 프론트에서 보낸 헤더 오버라이드 허용
    if (cfCountry || cfRegion) {
      console.warn('[extractGeoFromHeaders] ⚠️ Using dev geo override:', cfCountry, cfRegion);
      return {
        country: cfCountry || undefined,
        region: cfRegion || undefined,
      };
    }
  }

  // Cloudflare도 아니고 dev 오버라이드도 없는 경우
  return { country: undefined, region: undefined };
}

export function extractThreatFromHeaders(headers: Record<string, unknown>): Pick<ThreatSignals, 'cfThreatScore' | 'cfBotScore'> {
  const h2 = normalizeHeaderKeys(headers);
  const threatKey = (process.env.CF_HEADER_THREAT_SCORE || 'cf-threat-score').toLowerCase();
  const botKey = (process.env.CF_HEADER_BOT_SCORE || 'cf-bot-score').toLowerCase();

  const cfThreatScore = asNumber(h2[threatKey]); // 0(안전) ~ 100(위험)
  const cfBotScore = asNumber(h2[botKey]);       // 99(안전) ~ 1(봇)

  return { cfThreatScore, cfBotScore };
}

// ---------- 2) ipregistry API 조회 (Geo + Threat) ----------
const CACHE_TTL_S = Number(process.env.IPREGISTRY_CACHE_TTL_S || 600);
const IPREGISTRY_TIMEOUT_MS = Number(process.env.IPREGISTRY_TIMEOUT_MS || 2000);

type Cache = { at: number; geo: GeoResult | null, signals: ThreatSignals | null };
const cacheGeoThreat = new Map<string, Cache>();

/**
 * ipregistry 조회
 * - country: ISO-3166-1 alpha-2 (예: US, KR)
 * - region: ISO-3166-2 (예: US-CA, KR-11) 또는 name 문자열
 */
export async function lookupIpregistry(ip: string): Promise<IpInfo | null> {
  const key = process.env.IPREGISTRY_API_KEY;
  if (!key) {
    console.warn('[lookupIpregistry] IPREGISTRY_API_KEY missing');
    return null;
  }
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), IPREGISTRY_TIMEOUT_MS);

    const client: IpregistryClient = new IpregistryClient(key)
    const res: ApiResponse<IpInfo> =
      await client.lookupIp(process.env.NODE_ENV === "production" ? ip : "180.64.206.16", IpregistryOptions.hostname(true));
    clearTimeout(to);

    if (!res || !res.data) {
      // 4xx/5xx → 캐시 null (짧은 TTL로 재시도 여지)
      console.warn(`[lookupIpregistry] ipregistry HTTP ${res}`);
      return null;
    }

    return res.data;
  } catch (e) {
    // 타임아웃/네트워크 오류 → 캐시 null
    console.warn('[lookupIpregistry] error:', String((e as any)?.message ?? e));
    return null;
  }
}

/** Geo + Threat (VPN/Proxy/Tor/DC 등) */
export async function lookupByIp(ip?: string | null): Promise<Cache | null> {
  // 캐시 조회
  const now = Math.floor(Date.now() / 1000);
  const c = cacheGeoThreat.get(ip);
  if (c && now - c.at < CACHE_TTL_S) return c;

  const data = await lookupIpregistry(ip);
  if (!data) {
    cacheGeoThreat.set(ip, { at: now, geo: null, signals: null });
    return null;
  }

  const { location, security: s, connection: conn } = data;

  const country = location?.country?.code?.toUpperCase() ?? null;

  // region 우선순위: code(ISO-3166-2) → name
  const regionCode = location?.region?.code;
  const regionName = location?.region?.name;
  const region = (regionCode && String(regionCode)) || (regionName && String(regionName)) || null;

  const geo: GeoResult = { country, region };
  const signals: ThreatSignals = {
    isVpn: !!s.is_vpn,
    isProxy: !!s.is_proxy,
    isTor: !!s.is_tor || !!s.is_tor_exit,
    isCloudProvider: !!s.is_cloud_provider,
    isAnonymous: !!s.is_anonymous,
    isThreat: !!s.is_threat,
    isAttacker: !!s.is_attacker,
    isAbuser: !!s.is_abuser,
    isBogon: !!s.is_bogon,
    isRelay: !!s.is_relay,
    asn: typeof conn.asn === 'number' ? conn.asn : undefined,
    asOrg: conn.organization || undefined,
    asType: conn.type || undefined,
  };

  cacheGeoThreat.set(ip, { at: now, geo, signals });
  return { at: now, geo, signals };
}

// ---------- 3) 종합 헬퍼 ----------
/**
 * Cloudflare 헤더 우선 → 없으면 ipregistry API
 * - dev 환경에선 둘 다 실패해도 fail-open 시그널을 주고
 * - prod 환경에선 country 없을 때 보수적으로 처리할지(가드에서) 정책으로 결정
 * - Geo + Threat 한 번에
 */
export async function detectGeoAndThreat(
  headers: Record<string, unknown>,
  ip?: string | null,
  opts?: { countryHeader?: string; regionHeader?: string }
): Promise<GeoThreatResult> {
  const geoHdr = extractGeoFromHeaders(headers, opts);
  const cfThreat = extractThreatFromHeaders(headers);

  let lookup: Cache | null = null;

  if (ip) {
    lookup = await lookupByIp(ip);
  }

  const country = geoHdr.country || lookup?.geo.country || undefined;
  const region = geoHdr.region || lookup?.geo.region || undefined;

  return {
    country,
    region,
    ...cfThreat,
    ...(lookup.signals || {})
  };
}

/**
 * 정책 레이어: 차단 판단
 * - 국가/지역 블록리스트(DB) + Threat 시그널
 * - 운영에선 fail-close 권장 (GEOFENCE_FAIL_OPEN=false)
 */
export function shouldBlock(
  r: GeoThreatResult,
  opts?: {
    blockedCountries?: string[];         // ISO-3166-1 alpha-2 (예: ["KP","IR","SY"])
    blockedRegions?: { [country: string]: string[] }; // ISO-3166-2 or 이름
    minCfThreatScore?: number;           // 기본 30 이상이면 위험
    maxCfBotScore?: number;              // 기본 30 이하면 위험
    blockOnCloudCenter?: boolean;         // 기본 true
    blockOnVpnOrProxy?: boolean;         // 기본 true
    blockOnTor?: boolean;                // 기본 true
    blockOnThreatFlag?: boolean;         // 기본 true
    blockOnBogon?: boolean;               // 기본 true (운영에서 강추)
    blockOnRelay?: boolean;               // 기본 true (proxy와 동일 취급)
    denyAsnList?: number[];               // 차단 ASN
    allowAsnList?: number[];              // 허용 ASN(최우선 통과)
    denyAsType?: string[];                // 예: ['hosting','business'] 등
    failOpen?: boolean;                  // dev에서만 true 권장
  }
): { blocked: boolean; reason: string } {
  const {
    blockedCountries = [],
    blockedRegions = {},
    minCfThreatScore = 30,
    maxCfBotScore = 30,
    blockOnCloudCenter = true,
    blockOnVpnOrProxy = true,
    blockOnTor = true,
    blockOnThreatFlag = true,
    blockOnBogon = true,
    blockOnRelay = true,
    allowAsnList = [],
    denyAsnList = [],
    denyAsType = ['hosting'], // 데이터센터형 연결차단
    failOpen = process.env.GEOFENCE_FAIL_OPEN === 'true'
  } = opts || {};

  // 0) Geo가 전혀 없을 때
  if (!r.country) {
    return failOpen
      ? { blocked: false, reason: 'geo_unavailable_dev' }
      : { blocked: true, reason: 'geo_unavailable_prod' };
  }

  // 🔹 0.5) ASN 우선 허용 (화이트리스트)
  if (r.asn && allowAsnList.includes(r.asn)) {
    return { blocked: false, reason: `allowlist_asn:${r.asn}` };
  }

  // 1) 국가 블록
  if (blockedCountries.includes(r.country)) {
    return { blocked: true, reason: `blocked_country:${r.country}` };
  }

  // 2) 지역 블록
  if (r.country && r.region && blockedRegions[r.country]?.length) {
    const regionList = blockedRegions[r.country];
    if (regionList.some(x => (r.region || '').toLowerCase() === x.toLowerCase())) {
      return { blocked: true, reason: `blocked_region:${r.country}:${r.region}` };
    }
  }

  // 3) Cloudflare 신호 기반
  if (r.cfThreatScore != null && r.cfThreatScore >= minCfThreatScore) {
    return { blocked: true, reason: `cf_threat_score:${r.cfThreatScore}` };
  }
  if (r.cfBotScore != null && r.cfBotScore <= maxCfBotScore) {
    return { blocked: true, reason: `cf_bot_score:${r.cfBotScore}` };
  }

  // 🔹 3) ASN/Type 차단
  if (r.asn && denyAsnList.includes(r.asn)) {
    return { blocked: true, reason: `denylist_asn:${r.asn}` };
  }
  if (r.asType && denyAsType.map(s => s.toLowerCase()).includes(r.asType.toLowerCase())) {
    return { blocked: true, reason: `deny_as_type:${r.asType}` };
  }

  // 🔹 4) Bogon/Relay (강력 권장)
  if (blockOnBogon && r.isBogon) return { blocked: true, reason: 'ipregistry:bogon' };
  if (blockOnRelay && r.isRelay) return { blocked: true, reason: 'ipregistry:relay' };

  // 5) ipregistry Threat
  if (blockOnThreatFlag && r.isThreat) return { blocked: true, reason: 'ipregistry:is_threat' };
  if (blockOnTor && r.isTor) return { blocked: true, reason: 'ipregistry:is_tor' };
  if (blockOnVpnOrProxy && (r.isVpn || r.isProxy)) return { blocked: true, reason: 'ipregistry:vpn_or_proxy' };
  if (blockOnCloudCenter && r.isCloudProvider) {
    return { blocked: true, reason: 'ipregistry:cloud_center' };
  }
  if (r.isAttacker) return { blocked: true, reason: 'ipregistry:is_attacker' };
  if (r.isAbuser) return { blocked: true, reason: 'ipregistry:is_abuser' };

  return { blocked: false, reason: 'ok' };
}