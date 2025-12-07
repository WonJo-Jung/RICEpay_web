import axios from 'axios';
import { SanctionsProvider } from './sanctions.provider';

export class OpenSanctionsProvider implements SanctionsProvider {
  private baseUrl = process.env.OPENSANCTIONS_API_URL || 'https://api.opensanctions.org';
  private apiKey = process.env.OPENSANCTIONS_API_KEY;

  constructor() {
    if (!this.apiKey) {
      throw new Error('OpenSanctionsProvider: Missing OPENSANCTIONS_API_KEY');
    }
  }

  /**
   * checkAddress()
   * - chain은 현재 사용하지 않지만 인터페이스 준수용 (나중에 체인별 정책 필요하면 활용)
   * - address를 OpenSanctions `sanctions` 데이터셋에서 검색
   * - blocked=false 는 “검색 결과 없음(total.value === 0)”일 때만 가능
   * - API 장애/에러 시에는 절대 false 반환하지 않고 throw (fail-closed)
   */
  async checkAddress(
    chain: string,
    address: string
  ): Promise<{ blocked: boolean; reason?: string; version?: string }> {
    try {
      const url = `${this.baseUrl}/search/sanctions`;

      const resp = await axios.get(url, {
        params: {
          q: address,
          limit: 10,
        },
        headers: {
          // curl에서 쓰던 그대로: Authorization: <API_KEY>
          Authorization: this.apiKey!,
        },
        timeout: 8000,
      });

      // 출처: https://api.opensanctions.org/#tag/Matching/operation/search_search__dataset__get
      const data = resp.data as {
        limit: number;
        offset: number;
        total: { value: number; relation: string };
        results: { id: string; caption: string; schema: string; properties: any;
          datasets: string[];referents: string[]; target: boolean;
          first_seen: string | null; last_seen: string | null; last_chage: string | null; }[];
        facets: any;
      };

      const hits = data.results;
      const total = data.total.value;

      if (total > 0 || hits.length > 0) {
        const datasets: string[] = hits.map((h) => h.datasets).flat();
        const datasetSummary = datasets.length
          ? datasets.join(', ')
          : undefined;

        return {
          blocked: true,
          reason: "OpenSanctions entity",
          // version에는 "어떤 제재 소스에서 걸렸는지" 정도를 넣어두면 좋음
          version: datasetSummary,
        };
      }

      // 매칭 없음 = allowed
      return { blocked: false };
    } catch (e: any) {
      // ❌ 여기서 false 반환하면 "제재 대상 아님"으로 오판 → 절대 안 됨
      // 상위 서비스에서 이 에러를 보고 송금을 중단하도록 설계 (503 등)
      const msg = e?.response?.data
        ? JSON.stringify(e.response.data)
        : String(e?.message || e);
      throw new Error(`opensanctions_error: ${msg}`);
    }
  }
}