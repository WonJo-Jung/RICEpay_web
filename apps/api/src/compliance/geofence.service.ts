// apps/api/src/modules/compliance/geofence.service.ts
import { Injectable } from '@nestjs/common';
import { detectGeo } from './utils/geo'; // ← 앞서 만든 detectGeo() 사용
import { prisma } from '../lib/db';      // 네가 쓰던 경로 유지

type GeofenceResult =
  | { blocked: true; level: 'COUNTRY' | 'REGION'; country?: string | null; region?: string | null; reason?: string | null }
  | { blocked: false; country?: string | null; region?: string | null; reason?: string | null };

@Injectable()
export class GeofenceService {
  /**
   * 헤더(CF-IPCountry 등) 우선 → 없으면 MaxMind 로컬 DB.
   * dev에선 geo 실패 시 fail-open, prod에선 정책에 맞게 fail-close도 가능.
   */
  async check(headers: Record<string, unknown>, ip?: string): Promise<GeofenceResult> {
    const { country, region } = await detectGeo(headers, ip, {
      countryHeader: process.env.GEOIP_HEADER_COUNTRY || 'cf-ipcountry',
      regionHeader: process.env.GEOIP_HEADER_REGION || 'cf-region',
    });

    // 0) geo 자체를 얻지 못한 경우
    if (!country) {
      const failOpen = process.env.GEOFENCE_FAIL_OPEN !== 'false' && process.env.NODE_ENV !== 'production';
      if (failOpen) {
        return { blocked: false, country: null, region: null, reason: 'geo_unavailable_dev' };
      }
      // 보수적으로 막고 싶으면 아래 주석을 해제
      return { blocked: true, level: 'COUNTRY', country: null, region: null, reason: 'geo_unavailable_prod' };
      // return { blocked: false, country: null, region: null, reason: 'geo_unavailable' };
    }

    // 1) 국가 차단
    const c = await prisma.blockedCountry.findUnique({ where: { code: country } });
    if (c) {
      return { blocked: true, level: 'COUNTRY', country, region: region ?? null, reason: c.reason ?? 'blocked_country' };
    }

    // 2) 지역 차단 (UA에 한정하지 말고 테이블에 있는 모든 국가별 region을 지원)
    const regs = await prisma.blockedRegion.findMany({ where: { country } });
    if (regs.length && region) {
      const name = String(region).toLowerCase();

      for (const r of regs) {
        // ⚠️ sanitize: PCRE 인라인 플래그 제거 (예: (?i))
        const sanitized = (r.pattern || '').replace(/^\(\?[A-Za-z]+\)/, '');
        let pat: RegExp | null = null;
        if (sanitized) {
          try {
            pat = new RegExp(sanitized, 'i'); // ← JS 방식으로 대소문자 무시
          } catch {
            pat = null; // 잘못된 패턴이면 무시하고 계속
          }
        }

        const exactHit = r.region?.toLowerCase() === name;
        const regexHit = pat ? pat.test(region) : false;

        if (exactHit || regexHit) {
          return {
            blocked: true,
            level: 'REGION' as const,
            country,
            region: r.region,
            reason: r.reason ?? 'blocked_region',
          };
        }
      }
    }

    // 통과
    return { blocked: false, country, region: region ?? null };
  }
}