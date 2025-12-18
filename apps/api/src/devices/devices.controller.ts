// devices.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './devices.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  async register(@Body() dto: RegisterDeviceDto) {
    console.log('Registering device:');
    console.log(dto.platform, dto.pushToken, dto.wallet);
    await this.devicesService.register(dto);
    return { ok: true };
  }
}