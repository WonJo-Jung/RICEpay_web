// devices.service.ts
import { Injectable } from '@nestjs/common';
import { RegisterDeviceDto } from './devices.dto';
import { prisma } from '../lib/db';

@Injectable()
export class DevicesService {
  async register(dto: RegisterDeviceDto) {
    const { wallet, pushToken, platform } = dto;

    // 동일 토큰 존재하면 업데이트, 없으면 생성
    await prisma.device.upsert({
      where: { pushToken },
      update: {
        wallet,
        platform,
        lastSeenAt: new Date(),
      },
      create: {
        wallet,
        pushToken,
        platform,
      },
    });
  }
}