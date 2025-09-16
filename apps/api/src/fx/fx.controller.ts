// 4. /v1/fx 엔드포인트를 담당하는 컨트롤러. 쿼리를 받아서 서비스 호출
import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
import { FxService } from './fx.service';
import { GetRateDto } from './dto/get-rate.dto';

@Controller('fx')
export class FxController {
  private allowed = (process.env.FX_ALLOWED_PAIRS ?? 'USD:MXN')
    .split(',').map(s => s.trim().toUpperCase());

  constructor(private fx: FxService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  async get(@Query() q: GetRateDto) {
    const pair = `${q.base}:${q.quote}`.toUpperCase();
    if (!this.allowed.includes(pair)) {
      throw new BadRequestException({ error: 'FX_PAIR_NOT_ALLOWED', pair });
    }
    const r = await this.fx.get(q.base, q.quote);
    return {
      base: r.base, quote: r.quote, rate: r.rate,
      asOf: r.asOf.toISOString(), source: r.source, stale: !!r.stale,
      ttlSeconds: Number(process.env.FX_TTL_SECONDS ?? 60),
      disclaimer: 'Indicative only. Not an offer or execution rate.',
    };
  }
}