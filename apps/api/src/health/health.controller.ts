// apps/api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/')
  root() {
    return { status: 'ok' };
  }

  @Get('/health')
  health() {
    return { status: 'ok' };
  }
}