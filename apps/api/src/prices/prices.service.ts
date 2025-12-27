import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type AlchemyPricesResponse = {
  data: Array<{
    symbol: string;
    prices: Array<{
      currency: string;      // e.g. "USD"
      value: string;         // e.g. "2580.12"
      lastUpdatedAt: string; // ISO string
    }>;
    error?: string | null;
  }>;
};

export type PricesSnapshot = {
  source: 'alchemy';
  fetchedAt: string; // server time
  ttlSeconds: number;
  prices: Record<string, { usd: number; lastUpdatedAt?: string }>;
};

@Injectable()
export class PricesService {
  private cache: { value: PricesSnapshot; expiresAtMs: number } | null = null;
  private lastGood: PricesSnapshot | null = null;

  constructor(
    private readonly http: HttpService,
  ) {}

  async getUsdPrices(symbols: string[] = ['ETH', 'USDC']): Promise<PricesSnapshot> {
    const apiKey = process.env.ALCHEMY_API_KEY;
    const ttlSeconds = Number(process.env.PRICES_TTL_SECONDS ?? 60);
    const now = Date.now();

    if (this.cache && now < this.cache.expiresAtMs) {
      return this.cache.value;
    }

    if (!apiKey) throw new ServiceUnavailableException('Missing ALCHEMY_API_KEY');

    const url = `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-symbol`;

    try {
      const params = new URLSearchParams();
      // symbols 파라미터를 여러 번 붙이는 방식
      for (const s of symbols) params.append('symbols', s);

      const res = await firstValueFrom(
        this.http.get<AlchemyPricesResponse>(`${url}?${params.toString()}`, {
          timeout: 5000,
        }),
      );

      const prices: PricesSnapshot['prices'] = {};
      for (const item of res.data?.data ?? []) {
        const usdRow = (item.prices ?? []).find((p) => p.currency === 'usd');
        if (!usdRow?.value || item.error) continue;

        prices[item.symbol] = {
          usd: Number(usdRow.value),
          lastUpdatedAt: usdRow.lastUpdatedAt,
        };
      }

      const snapshot: PricesSnapshot = {
        source: 'alchemy',
        fetchedAt: new Date().toISOString(),
        ttlSeconds,
        prices,
      };

      // 캐시 + 마지막 정상값 저장
      this.cache = { value: snapshot, expiresAtMs: now + ttlSeconds * 1000 };
      this.lastGood = snapshot;

      return snapshot;
    } catch (e) {
      // 장애 시 마지막 정상값 반환(없으면 에러)
      if (this.lastGood) return this.lastGood;
      throw new ServiceUnavailableException('Failed to fetch prices from Alchemy');
    }
  }
}