// apps/api/src/modules/compliance/geofence.service.ts
import { Injectable } from '@nestjs/common';
import { detectGeoAndThreat, shouldBlock } from './utils/geo'; // ← 새 유틸 둘 다 사용
import { prisma } from '../lib/db';      // 네가 쓰던 경로 유지

// 🔹 간단 TTL 캐시 유틸
type CacheBox<T> = { at: number; ttl: number; val: T };
function getOrStale<T>(box?: CacheBox<T>) {
  if (!box) return undefined;
  if (Date.now() - box.at < box.ttl) return box.val;
  return undefined;
}

// 🔹 차단 목록 캐시 (메모리)
let countriesCache: CacheBox<string[]> | undefined;
let regionsCache: CacheBox<Record<string, string[]>> | undefined;
// 기본 TTL: 60초 (원하면 .env로 노출)
const LIST_TTL_MS = Number(process.env.BLOCKLIST_TTL_MS ?? 60_000);

// 🔹 ENV → 리스트 파서
function parseNumList(env?: string): number[] {
  if (!env) return [];
  return env.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n));
}
function parseStrList(env?: string): string[] {
  if (!env) return [];
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

// 🔹 ASN Allow/Deny
const ALLOW_ASN_LIST = parseNumList(process.env.ALLOW_ASN_LIST || '');
const DENY_ASN_LIST  = parseNumList(process.env.DENY_ASN_LIST || '');
// 호스팅 타입 차단 (ipregistry connection.type 기준: 'hosting','isp','business' 등)
const DENY_AS_TYPE   = parseStrList(process.env.DENY_AS_TYPE || 'hosting');

type GeofenceResult =
  | { blocked: true; level: 'COUNTRY' | 'REGION' | 'THREAT'; country?: string | null; region?: string | null; reason?: string | null }
  | { blocked: false; country?: string | null; region?: string | null; reason?: string | null };

@Injectable()
export class GeofenceService {
  private async loadBlockedLists(): Promise<{ blockedCountries: string[]; blockedRegions: Record<string,string[]> }> {
    // 1) 캐시 hit 확인
    const hitCountries = getOrStale(countriesCache);
    const hitRegions   = getOrStale(regionsCache);
    if (hitCountries && hitRegions) {
      return { blockedCountries: hitCountries, blockedRegions: hitRegions };
    }

    // 2) DB 차단 목록 불러오기
    const [countries, regions] = await Promise.all([
      prisma.blockedCountry.findMany(),                               // { code, reason }
      prisma.blockedRegion.findMany({ orderBy: { country: 'asc' } }), // { country, region, pattern, reason }
    ]);

    // blockedCountries: string[]
    const blockedCountries = countries.map(c => c.code.toUpperCase());

    // blockedRegions: { [country: string]: string[] }  (정확 매칭용)
    const blockedRegions: Record<string, string[]> = {};
    for (const reg of regions) {
      const key = (reg.country || '').toUpperCase();
      if (!key) continue;
      blockedRegions[key] ||= [];
      if (reg.region) blockedRegions[key].push(reg.region);
    }

    // 3) 캐시 저장
    countriesCache = { at: Date.now(), ttl: LIST_TTL_MS, val: blockedCountries };
    regionsCache   = { at: Date.now(), ttl: LIST_TTL_MS, val: blockedRegions };

    return { blockedCountries, blockedRegions };
  }

  /**
   * 헤더(CF-IPCountry 등) 우선 → 없으면 MaxMind 로컬 DB.
   * dev에선 geo 실패 시 fail-open, prod에선 정책에 맞게 fail-close도 가능.
   */
  async check(headers: Record<string, unknown>, ip?: string): Promise<GeofenceResult> {
    // 1) Geo + Threat 한번에 계산 (Cloudflare 헤더 + ipregistry)
    const r = await detectGeoAndThreat(headers, ip, {
      countryHeader: process.env.CF_HEADER_COUNTRY || 'cf-ipcountry',
      regionHeader: process.env.CF_HEADER_REGION || 'cf-region',
    });

    // 2) geo 자체가 없을 때 정책
    if (!r.country) {
      const failOpen = process.env.GEOFENCE_FAIL_OPEN !== 'false' && process.env.NODE_ENV !== 'production';
      if (failOpen) {
        return { blocked: false, country: null, region: null, reason: 'geo_unavailable_dev' };
      }
      // 보수적으로 막고 싶으면 아래 주석을 해제
      return { blocked: true, level: 'COUNTRY', country: null, region: null, reason: 'geo_unavailable_prod' };
      // return { blocked: false, country: null, region: null, reason: 'geo_unavailable' };
    }

    // 🔹 차단 목록(캐시) 로드
    const { blockedCountries, blockedRegions } = await this.loadBlockedLists();

    // 4) 정책 판단 (ASN/Cloudflare threat/bot, ipregistry security까지 포함)
    const decision = shouldBlock(r, {
      blockedCountries,
      blockedRegions,
      // 필요시 환경변수로 조절
      minCfThreatScore: Number(process.env.CF_MIN_THREAT_SCORE ?? 30),
      maxCfBotScore: Number(process.env.CF_MAX_BOT_SCORE ?? 30),
      blockOnCloudCenter: process.env.BLOCK_CC !== 'false',
      blockOnVpnOrProxy: process.env.BLOCK_VPN_PROXY !== 'false',
      blockOnTor: process.env.BLOCK_TOR !== 'false',
      blockOnThreatFlag: process.env.BLOCK_THREAT !== 'false',
      blockOnBogon: process.env.BLOCK_BOGON !== 'false',
      blockOnRelay: process.env.BLOCK_RELAY !== 'false',
      allowAsnList: ALLOW_ASN_LIST,
      denyAsnList: DENY_ASN_LIST,
      denyAsType:  DENY_AS_TYPE,
      failOpen: process.env.GEOFENCE_FAIL_OPEN === 'true',
    });

    if (decision.blocked) {
      // 국가/지역 레벨을 구분해서 리턴하면 기존 핸들러와 호환됨
      // reason 문자열을 보고 간단히 분류
      const reason = decision.reason || 'blocked';
      let level: 'COUNTRY' | 'REGION' | 'THREAT' = 'THREAT';
      if (reason.startsWith('blocked_country')) level = 'COUNTRY';
      else if (reason.startsWith('blocked_region')) level = 'REGION';

      return {
        blocked: true,
        level,
        country: r.country ?? null,
        region: r.region ?? null,
        reason,
      };
    }

    // 통과
    return { blocked: false, country: r.country ?? null, region: r.region ?? null, reason: 'ok' };
  }
}