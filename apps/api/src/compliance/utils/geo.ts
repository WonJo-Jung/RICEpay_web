/**
 * Geolocation utilities
 * 1) Cloudflare 헤더(CF-IPCountry 등) 최우선
 * 2) MaxMind GeoLite2 Country DB 로컬 조회 (fallback)
 * 3) 간단 메모리 캐시로 성능 보강
 *
 * 환경 변수:
 *   GEOIP_COUNTRY_DB_PATH=./geo/GeoLite2-Country.mmdb
 *   GEOIP_CITY_DB_PATH=./geo/GeoLite2-City.mmdb
 *
 * 의존:
 *   pnpm add @maxmind/geoip2-node
 */

import { Reader, ReaderModel } from '@maxmind/geoip2-node';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type GeoResult = { country?: string | null; region?: string | null };

// ---------- 1) Cloudflare 헤더 파싱 ----------
/**
 * Cloudflare 프록시 뒤라면 모든 요청에 'CF-IPCountry' 헤더가 옴.
 * (선택) Workers 등에서 region/city를 커스텀 헤더로 넣었다면 opts로 지정 가능.
 * 
 * 로컬 개발 시, ALLOW_DEV_HEADERS=true 환경변수가 설정되어 있으면
 * 프론트엔드에서 cf-ipcountry / cf-region 헤더를 수동 주입하여 테스트 가능.
 */
export function extractGeoFromHeaders(
  headers: Record<string, unknown>,
  opts?: { countryHeader?: string; regionHeader?: string }
): GeoResult {
  const h2 = normalizeHeaderKeys(headers);

  // 기본 헤더 키
  const countryKey = (opts?.countryHeader || 'cf-ipcountry').toLowerCase();
  const regionKey = (opts?.regionHeader || 'cf-region').toLowerCase();

  // Cloudflare 기준
  const cfCountry = asString(h2[countryKey])?.toUpperCase();
  const cfRegion = asString(h2[regionKey]);

  // Cloudflare 통과 여부 추정 (대표 헤더)
  const fromCloudflare =
    !!h2['cf-ray'] || !!h2['cf-connecting-ip'] || !!h2['cdn-loop'];

  // 개발용 오버라이드 플래그
  const allowDev = process.env.ALLOW_DEV_HEADERS === 'true';

  // 호스트 기반으로 로컬 개발 여부도 보조 판단
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
      console.warn(
        '[extractGeoFromHeaders] ⚠️ Using dev geo override:',
        cfCountry,
        cfRegion
      );
      return {
        country: cfCountry || undefined,
        region: cfRegion || undefined,
      };
    }
  }

  // Cloudflare도 아니고 dev 오버라이드도 없는 경우
  return { country: undefined, region: undefined };
}

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

// ---------- 2) MaxMind GeoLite2 (로컬 DB) ----------
/**
 * Reader는 무거우므로 모듈 전역 싱글톤으로 보관.
 * 파일이 없거나 로드 실패 시 reader=null 로 두고 안전하게 fail-open.
 */
const COUNTRY_DB_PATH = process.env.GEOIP_COUNTRY_DB_PATH || path.resolve(process.cwd(), 'geo', 'GeoLite2-Country.mmdb');
const CITY_DB_PATH = process.env.GEOIP_CITY_DB_PATH || path.resolve(process.cwd(), 'geo', 'GeoLite2-City.mmdb');

let co_reader: ReaderModel | null = null;
let ci_reader: ReaderModel | null = null;
let triedCoOpen = false;
let triedCiOpen = false;

async function getCountryReader(): Promise<ReaderModel | null> {
  if (co_reader || triedCoOpen) return co_reader;
  triedCoOpen = true;
  try {
    if (fs.existsSync(COUNTRY_DB_PATH)) {
      co_reader = await Reader.open(COUNTRY_DB_PATH);
    } else {
      // 파일이 없으면 그대로 null (개발/테스트 편의상 fail-open)
      co_reader = null;
    }
  } catch {
    co_reader = null;
  }
  return co_reader;
}

async function getCityReader(): Promise<ReaderModel | null> {
  if (ci_reader || triedCiOpen) return ci_reader;
  triedCiOpen = true;
  try {
    if (fs.existsSync(CITY_DB_PATH)) {
      ci_reader = await Reader.open(CITY_DB_PATH);
    } else {
      // 파일이 없으면 그대로 null (개발/테스트 편의상 fail-open)
      ci_reader = null;
    }
  } catch {
    ci_reader = null;
  }
  return ci_reader;
}

// 간단 캐시 (IP → GeoResult), 기본 10분 TTL
const CACHE_TTL_S = Number(process.env.GEOIP_CACHE_TTL_S || 600);
const cache = new Map<string, { at: number; val: GeoResult | null }>();

/**
 * MaxMind 로컬 조회 (Fallback 용)
 * - country: ISO-3166-1 alpha-2 (예: US, KR)
 * - region: subdivision isoCode(예: CA-CA 같은 형식이 아닌 경우도 있어 null 가능)
 */
export async function lookupGeoByIp(ip?: string | null): Promise<GeoResult | null> {
  if (!ip) return null;

  // 캐시 조회
  const now = Math.floor(Date.now() / 1000);
  const c = cache.get(ip);
  if (c && now - c.at < CACHE_TTL_S) return c.val;

  const country_reader = await getCountryReader();
  if (!country_reader) {
    cache.set(ip, { at: now, val: null });
    return null;
  }

  const city_reader = await getCityReader();
  if (!city_reader) {
    cache.set(ip, { at: now, val: null });
    return null;
  }

  try {
    const co = country_reader.country(ip);
    const country = co?.country?.isoCode ?? null;
    // Country DB는 세부 region 정보가 항상 있지는 않음
    const ci = city_reader.city(ip);
    const region = ci?.subdivisions?.[0]?.isoCode ?? null;

    const val: GeoResult = { country, region };
    cache.set(ip, { at: now, val });
    return val;
  } catch {
    cache.set(ip, { at: now, val: null });
    return null;
  }
}

// ---------- 3) 종합 헬퍼 ----------
/**
 * Cloudflare 헤더 우선 → 없으면 로컬 DB
 * - dev 환경에선 둘 다 실패해도 fail-open 시그널을 주고
 * - prod 환경에선 country 없을 때 보수적으로 처리할지(가드에서) 정책으로 결정
 */
export async function detectGeo(
  headers: Record<string, unknown>,
  ip?: string | null,
  opts?: { countryHeader?: string; regionHeader?: string }
): Promise<GeoResult> {
  const fromHdr = extractGeoFromHeaders(headers, opts);
  if (fromHdr.country) return fromHdr;

  const fromDb = await lookupGeoByIp(ip);
  if (fromDb?.country) return fromDb;

  // 둘 다 실패 → 호출부에서 환경별 정책으로 처리
  return { country: undefined, region: undefined };
}