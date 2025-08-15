
import { Controller, Post, Body } from '@nestjs/common';
import { z } from 'zod';
import { CreatePaymentSchema } from '@ricepay/shared';

@Controller('payments')
export class PaymentsController {
  @Post()
  create(@Body() body: unknown) {
    const parsed = CreatePaymentSchema.parse(body);
    // TODO: enqueue job to process/send payment, record DB
    return { ok: true, data: parsed };
  }
}
