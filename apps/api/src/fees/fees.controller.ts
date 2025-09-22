import { Controller, Get, Query } from '@nestjs/common';
import { FeesService } from './fees.service';
import { PreviewDto } from './preview.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('fees')
export class FeesController {
  constructor(private readonly svc: FeesService) {}
  @Throttle({ fees: { ttl: 1000, limit: 8 } }) // ttl: 1s, 초당 8회
  @Get('preview')
  preview(@Query() q: PreviewDto) { return this.svc.preview(q); }
}