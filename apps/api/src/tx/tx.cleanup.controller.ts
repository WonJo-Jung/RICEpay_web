import { Controller, Post, UseGuards } from '@nestjs/common';
import { TxCleanupCron } from './tx.cleanup.cron';
import { MaintenanceGuard } from '../common/guards/maintenance.guard';

@Controller('/tx')
export class TxCleanupController {
  constructor(private cron: TxCleanupCron) {}

  @UseGuards(MaintenanceGuard)
  @Post('/cleanup-pending')
  async runOnce() {
    await this.cron.cleanupStalePending();
    return { ok: true };
  }
}