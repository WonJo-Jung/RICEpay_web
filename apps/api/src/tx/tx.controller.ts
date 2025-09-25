import { Body, Controller, Get, Post, Query, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { CreateTxDto } from './dto/create-tx.dto';
import { TxService } from './tx.service';
import { TxStream } from './tx.stream';
import type { TxRecord } from '@ricepay/shared';

@Controller('/tx')
export class TxController {
  constructor(private svc: TxService, private stream: TxStream) {}

  @Post()
  create(@Body() dto: CreateTxDto): Promise<TxRecord> {
    return this.svc.upsertPending(dto);
  }

  @Get()
  getByHash(@Query('hash') hash: string): Promise<TxRecord | null> {
    return this.svc.findByHash(hash);
  }

  @Get('/stream')
  @Sse()
  streamAll(): Observable<MessageEvent> {
    return this.stream.observable().pipe(map((d) => ({ data: d } as MessageEvent)));
  }
}