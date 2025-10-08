import axios from 'axios';
import { SanctionsProvider } from './sanctions.provider';

/**
 * OFACLookupProvider (개발/테스트용)
 * - 최신 Treasury 공식 CSV 다운로드 경로 기반
 * - 운영 환경에서는 ComplyAdvantage 등 공식 RegTech API로 교체 필요
 */
export class OfacLookupProvider implements SanctionsProvider {
  // 최신 공식 CSV URL (2025 기준)
  private url =
    process.env.OFACLOOKUP_URL ||
    'https://sanctionslistservice.ofac.treas.gov/api/download/SDN.CSV';

  async checkAddress(chain: string, address: string) {
    try {
      const res = await axios.get(this.url, { responseType: 'text', timeout: 7000 });
      const text = res.data.toLowerCase();
      const needle = address.toLowerCase();

      // 단순 문자열 매칭 — 개발/테스트 용도
      const blocked = text.includes(needle);
      return blocked
        ? { blocked: true, reason: 'OFAC match (basic CSV search)' }
        : { blocked: false };
    } catch (e) {
      // 🔴 중요: 여기서 false 반환하면 "허용"이 되어버림
      // 공급자 장애는 상위(Guard)에서 fail-open/503 정책으로 처리해야 함
      throw new Error(`ofaclookup_error: ${String((e as any)?.message || e)}`);
    }
  }
}