import { BadRequestException, Body, Controller, Get, Post, Query, Req, Sse, UseGuards, UseInterceptors } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { CreateTxDto } from './dto/create-tx.dto';
import { TxService } from './tx.service';
import { TxStream } from './tx.stream';
import type { TxRecord } from '@ricepay/shared';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ComplianceGuard } from '../compliance/compliance.guard';
import { lookupIpregistry } from '../compliance/utils/geo';

@Controller('/tx')
export class TxController {
  constructor(private svc: TxService, private stream: TxStream) {}

  @Throttle({ tx: { ttl: 1, limit: 3 } }) // 초당 3번
  @UseGuards(ComplianceGuard)
  @Post()
  async create(@Body() dto: CreateTxDto, @Req() req: any): Promise<TxRecord> {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').trim();
    if (!ip) {
      throw new BadRequestException({ error: 'TX_IP_INVALID', ip });
    }

    const lookup = await lookupIpregistry(ip);
    return this.svc.upsertPending(dto, lookup);
  }

  @UseInterceptors(CacheInterceptor)
  @Throttle({ tx: { ttl: 1, limit: 10 } }) // 초당 10번
  @Get()
  getByHash(@Query('hash') hash: string): Promise<TxRecord | null> {
    return this.svc.findByHash(hash);
  }

  @SkipThrottle() // 장기연결: 인프라에서 동시연결 제한
  @Get('/stream')
  @Sse()
  streamAll(): Observable<MessageEvent> {
    return this.stream.observable().pipe(map((d) => ({ data: d } as MessageEvent)));
  }
}