// apps/api/src/tx/tx.reindex.controller.ts (선택, 이미 있으면 생략)
import { Controller, Post, UseGuards } from '@nestjs/common';
import { TxCron } from './tx.cron';
import { MaintenanceGuard } from '../common/guards/maintenance.guard';

@Controller('/tx')
export class TxReindexController {
  constructor(private cron: TxCron) {}

  @UseGuards(MaintenanceGuard)
  @Post('/backfill')
  async runOnce() {
    await this.cron.backfillConfirmations();
    return { ok: true };
  }
}