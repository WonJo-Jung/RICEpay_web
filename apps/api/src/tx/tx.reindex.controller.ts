// apps/api/src/tx/tx.reindex.controller.ts (선택, 이미 있으면 생략)
import { Controller, Post } from '@nestjs/common';
import { TxCron } from './tx.cron';

@Controller('/tx')
export class TxReindexController {
  constructor(private cron: TxCron) {}
  @Post('/backfill')
  async runOnce() {
    await this.cron.backfillConfirmations();
    return { ok: true };
  }
}