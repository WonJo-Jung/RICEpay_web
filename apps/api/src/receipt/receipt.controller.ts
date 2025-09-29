import { Controller, Get, Param, Query, Post, NotFoundException } from '@nestjs/common';
import { ReceiptService } from './receipt.service';

@Controller()
export class ReceiptController {
  constructor(private receipts: ReceiptService) {}

  @Get('activity')
  activity(
    @Query('address') address?: string,
    @Query('chainId') chainId?: string,
    @Query('direction') direction?: 'SENT' | 'RECEIVED',
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.receipts.listActivity({
      address,
      chainId: chainId ? Number(chainId) : undefined,
      direction,
      cursor,
      limit: limit ? Number(limit) : undefined,
      from,
      to,
    });
  }

  @Get('receipts/:id')
  async receipt(@Param('id') id: string) {
    const r = await this.receipts.getById(id);
    if (!r) throw new NotFoundException('receipt not found');
    return r;
  }

  @Get('receipts/share/:token')
  async receiptByToken(@Param('token') token: string) {
    const r = await this.receipts.getByShareToken(token);
    if (!r) throw new NotFoundException('receipt not found');
    return r;
  }

  @Post('receipts/:id/share')
  async share(@Param('id') id: string) {
    const r = await this.receipts.getById(id);
    if (!r) throw new NotFoundException('receipt not found');
    const token = await this.receipts.ensureShareToken(id);
    return { token };
  }
}