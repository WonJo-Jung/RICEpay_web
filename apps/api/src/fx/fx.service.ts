// 4. 환율 비즈니스 로직. 공급자 선택하고 호출. 캐시 사용.
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { Currency, RateProvider, RateQuote } from './types';
import { FrankfurterProvider } from './providers/frankfurter.provider';
import { OxrProvider } from './providers/oxr.provider';

@Injectable()
export class FxService {
  private ttlMs = Number(process.env.FX_TTL_SECONDS ?? 60) * 1000;
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private cfg: ConfigService,
    private frank: FrankfurterProvider,
    private oxr: OxrProvider,
  ) {}

  private key(b: Currency, q: Currency) { return `fx:${b}:${q}`; }

  private selectProviders(): RateProvider[] {
    const p = (this.cfg.get('FX_PRIMARY') ?? 'FRANKFURTER').toUpperCase();
    const f = (this.cfg.get('FX_FALLBACK') ?? '').toUpperCase();
    const map: Record<string, RateProvider> = { FRANKFURTER: this.frank, OXR: this.oxr };
    const list: RateProvider[] = [];
    if (map[p]) list.push(map[p]);
    if (f && map[f]) list.push(map[f]);
    if (!list.length) list.push(this.frank);
    return list;
  }

  async get(base: Currency, quote: Currency): Promise<RateQuote> {
    const key = this.key(base, quote);
    const hit = await this.cache.get<RateQuote>(key);
    if (hit) return hit;

    let lastErr: any;
    for (const prov of this.selectProviders()) {
      try {
        const q = await prov.getRate(base, quote);
        await this.cache.set(key, q, this.ttlMs);
        return q;
      } catch (e) { lastErr = e; }
    }

    const stale = await this.cache.get<RateQuote>(key);
    if (stale) return { ...stale, stale: true };
    throw lastErr ?? new Error('FX_UNAVAILABLE');
  }
}