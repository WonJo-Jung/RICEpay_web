import { Controller, Get, Query } from '@nestjs/common';
import { FeesService } from './fees.service';
import { PreviewDto } from './preview.dto';

@Controller('fees')
export class FeesController {
  constructor(private readonly svc: FeesService) {}
  @Get('preview') preview(@Query() q: PreviewDto) { return this.svc.preview(q); }
}