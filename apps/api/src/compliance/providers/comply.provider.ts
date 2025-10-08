import axios, { AxiosInstance } from 'axios';
import { SanctionsProvider } from './sanctions.provider';

/**
 * Comply Advantage Sanctions Provider
 *
 * - 개발(Sandbox)과 운영(Production) 모두 같은 코드/엔드포인트 포맷 사용
 * - 인증 헤더: Authorization: Token <API_KEY>
 * - 기본 검색 엔드포인트: POST /searches (sanctions 전용 검색)
 *
 * ⚠️ 실제 응답 스키마는 계정/플랜에 따라 약간 달라질 수 있어
 *   아래 매핑부를 필요 시 조정해도 돼.
 */

const THRESHOLD = process.env.SANCTIONS_CB_THRESHOLD || 5;
const COOLDOWN = process.env.SANCTIONS_CB_COOLDOWN_S || 60;
const TTL = process.env.SANCTIONS_CACHE_TTL_S || 86400; // 1d
const RETRIES = process.env.SANCTIONS_RETRIES || 1;
const ENV = process.env.NODE_ENV !== 'production'; // dev: fail-open
const CA_BASE_URL = process.env.COMPLY_ADVANTAGE_BASE_URL || 'https://api.complyadvantage.com';
const TIMEOUT = process.env.SANCTIONS_TIMEOUT_MS || 2500;

type Res = { blocked: boolean; reason?: string; version?: string };

// 간단한 in-memory 캐시 (운영에선 Redis 권장)
const mem = new Map<string, { at: number; res: Res }>();
let failCount = 0;
const threshold = Number(THRESHOLD);
const cooldownS = Number(COOLDOWN);
let openedAt = 0;

export class ComplyAdvantageProvider implements SanctionsProvider {
  private http: AxiosInstance;
  private cacheTtl = Number(TTL);
  private retries  = Number(RETRIES);
  private failOpen = ENV;

  constructor(apiKey: string) {
    this.http = axios.create({
      baseURL: CA_BASE_URL,
      timeout: Number(TIMEOUT),
      headers: { Authorization: `Token ${apiKey}` },
    });
  }

  private key(c: string, a: string) { return `${c}:${a}`; }
  private now() { return Math.floor(Date.now() / 1000); }
  private circuitOpen() {
    if (failCount >= threshold) return true;
    if (openedAt && (Date.now() - openedAt) / 1000 < cooldownS) return true;
    return false;
  }
  private recordFail() { failCount++; if (failCount >= threshold) openedAt = Date.now(); }
  private recordSuccess() { failCount = 0; openedAt = 0; }

  /**
   * Comply Advantage 검색 전략
   *
   * - 주소 문자열(to) 그대로 search_term에 넣고 sanctions 전용 검색
   * - fuzziness는 지갑주소에선 0(정확 일치), 인명/법인 검색 땐 0.7~0.9 권장
   * - types: ['sanctions'] 로 제한 (필요 시 'watchlists'/'pep' 추가 가능)
   */
  private async screen(chain: string, address: string): Promise<Res> {
    // POST /searches
    // Body 예시:
    // {
    //   "search_term": "0xabc...def",
    //   "fuzziness": 0,
    //   "filters": { "types": ["sanctions"] }
    // }
    const { data } = await this.http.post('/searches', {
      search_term: address,
      fuzziness: 0,
      filters: { types: ['sanctions'] },
    });

    // 응답 매핑(예시): data.matches 배열에 제재 매치가 있으면 blocked
    // 일부 플랜은 data.content.matches 또는 data.data.matches 등으로 올 수 있어
    // 안전하게 여러 경로를 탐색한다.
    const matches =
      data?.matches ??
      data?.content?.matches ??
      data?.data?.matches ??
      [];

    const hit = Array.isArray(matches) ? matches.find((m: any) => {
      const type  = m?.match_types || m?.types || [];
      const lists = m?.lists || m?.sources || [];
      // "sanctions" 타입이거나, OFAC/EU/UN 목록에 해당되면 hit
      const isSanctionsType =
        (Array.isArray(type) && type.some((t: string) => /sanction/i.test(t))) ||
        (Array.isArray(lists) && lists.some((s: string) => /(OFAC|EU|UN|HMT)/i.test(s)));
      return !!isSanctionsType;
    }) : undefined;

    const blocked = !!hit;
    const reason =
      (hit?.entity_name && `sanctions_match:${hit.entity_name}`) ||
      (hit?.lists?.[0]) ||
      (hit?.sources?.[0]) ||
      (blocked ? 'sanctions_hit' : undefined);

    // ComplyAdvantage는 별도 snapshot/version 개념이 없을 수 있으므로 생략/옵션
    const version = data?.version ?? data?.snapshot ?? undefined;

    return { blocked, reason, version };
  }

  async checkAddress(chain: string, address: string): Promise<Res> {
    const k = this.key(chain, address);
    const cached = mem.get(k);
    if (cached && this.now() - cached.at < this.cacheTtl) return cached.res;

    if (this.circuitOpen()) {
      return this.failOpen
        ? { blocked: false, reason: 'fail_open_dev' }
        : { blocked: true, reason: 'provider_unavailable' };
    }

    for (let i = 0; i <= this.retries; i++) {
      try {
        const res = await this.screen(chain, address);
        mem.set(k, { at: this.now(), res });
        this.recordSuccess();
        return res;
      } catch (e) {
        this.recordFail();
        // 다음 루프에서 재시도
      }
    }

    // 최종 실패
    return this.failOpen
      ? { blocked: false, reason: 'fail_open_dev' }
      : { blocked: true, reason: 'provider_error' };
  }
}