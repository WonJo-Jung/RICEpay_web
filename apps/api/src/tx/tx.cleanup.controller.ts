import { Controller, Post } from '@nestjs/common';
import { TxCleanupCron } from './tx.cleanup.cron';

@Controller('/tx')
export class TxCleanupController {
  constructor(private cron: TxCleanupCron) {}
  @Post('/cleanup-pending')
  async runOnce() {
    await this.cron.cleanupStalePending();
    return { ok: true };
  }
}