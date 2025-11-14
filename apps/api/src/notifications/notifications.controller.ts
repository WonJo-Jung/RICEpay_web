// notifications.controller.ts
import { Controller, Get, Param, Patch, Body, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // 지갑 기준으로 가져오기 (지금 구조에 맞춰 심플하게)
  @Get('wallet/:wallet')
  async listForWallet(@Param('wallet') wallet: string) {
    return this.notificationsService.listForWallet(wallet);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    await this.notificationsService.markAsRead(id);
    return { ok: true };
  }

  @Get('unread-count')
  async unreadNoti(@Query('wallet') wallet: string) {
    const count = await this.notificationsService.unreadNoti(wallet);
    return { unreadCount: count };
  }
}
