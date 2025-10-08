import { Body, Controller, Get, Post, Query, Sse, UseGuards, UseInterceptors } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { CreateTxDto } from './dto/create-tx.dto';
import { TxService } from './tx.service';
import { TxStream } from './tx.stream';
import type { TxRecord } from '@ricepay/shared';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ComplianceGuard } from '../compliance/compliance.guard';

@Controller('/tx')
export class TxController {
  constructor(private svc: TxService, private stream: TxStream) {}

  @Throttle({ tx: { ttl: 1, limit: 3 } }) // 초당 3번
  @UseGuards(ComplianceGuard)
  @Post()
  create(@Body() dto: CreateTxDto): Promise<TxRecord> {
    return this.svc.upsertPending(dto);
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