import axios, { AxiosInstance } from 'axios';
import { SanctionsProvider } from './sanctions.provider';

type Res = { blocked: boolean; reason?: string; version?: string };

const THRESHOLD = process.env.SANCTIONS_CB_THRESHOLD || 5;
const COOLDOWN = process.env.SANCTIONS_CB_COOLDOWN_S || 60;
const TTL = process.env.SANCTIONS_CACHE_TTL_S || 86400;
const RETRIES = process.env.SANCTIONS_RETRIES || 1;
const ENV = process.env.NODE_ENV !== 'production';
const TRM_BASE_URL = process.env.SANCTIONS_TRM_BASE_URL || 'https://api.example.com/v1'; // 실제 TRM 엔드포인트로 교체
const TIMEOUT = process.env.SANCTIONS_TIMEOUT_MS || 2500;

// 아주 단순한 in-memory 캐시(개발/소규모 용). 운영에선 Redis 권장.
const mem = new Map<string, { at: number; res: Res }>();

let failCount = 0;
const threshold = Number(THRESHOLD);
const cooldownS = Number(COOLDOWN);
let openedAt = 0;

export class TrmSanctionsProvider implements SanctionsProvider {
  private http: AxiosInstance;
  private cacheTtl = Number(TTL); // 1일
  private retries = Number(RETRIES);
  private failOpen = ENV; // dev: fail-open

  constructor(apiKey: string) {
    this.http = axios.create({
      baseURL: TRM_BASE_URL,
      timeout: Number(TIMEOUT),
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }

  private key(c: string, a: string): string {
    return `${c}:${a}`;
  }
  private now(): number {
    return Math.floor(Date.now() / 1000);
  }
  private circuitOpen(): boolean {
    // 실패 횟수 초과
    if (failCount >= threshold) return true;
    // 쿨다운 시간 내
    if (openedAt && (Date.now() - openedAt) / 1000 < cooldownS) return true;
    return false;
  }
  private recordFail(): void {
    failCount++;
    if (failCount >= threshold) openedAt = Date.now();
  }
  private recordSuccess(): void {
    failCount = 0;
    openedAt = 0;
  }

  // 👇 여기! Promise<Res> 로 써야 함
  async checkAddress(chain: string, address: string): Promise<Res> {
    const k = this.key(chain, address);

    // 캐시 히트
    const cached = mem.get(k);
    if (cached && this.now() - cached.at < this.cacheTtl) return cached.res;

    // 회로 차단 상태
    if (this.circuitOpen()) {
      return this.failOpen
        ? { blocked: false, reason: 'fail_open_dev' }
        : { blocked: true, reason: 'provider_unavailable' };
    }

    // 재시도 루프
    for (let i = 0; i <= this.retries; i++) {
      try {
        // TODO: 실제 TRM API 스펙에 맞춰 경로/페이로드/응답 매핑 수정
        const { data } = await this.http.post('/sanctions/screen', { chain, address });

        // 안전 매핑 (Object is possibly 'undefined' 방지)
        const blocked = Boolean(data && (data.blocked ?? data.result?.blocked));
        const reason =
          (data && (data.reason ?? data.result?.reason ?? data.source)) || undefined;
        const version = (data && (data.version ?? data.snapshot)) || undefined;

        const res: Res = { blocked, reason, version };

        // 캐시 저장
        mem.set(k, { at: this.now(), res });
        this.recordSuccess();
        return res;
      } catch (e) {
        this.recordFail();
        // 다음 루프로 재시도
      }
    }

    // 최종 실패
    return this.failOpen
      ? { blocked: false, reason: 'fail_open_dev' }
      : { blocked: true, reason: 'provider_error' };
  }
}