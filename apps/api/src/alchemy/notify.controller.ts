import { Body, Controller, Post } from '@nestjs/common';
import { AlchemyNotifyService } from './notify.service';

type RegisterWalletDto = {
  address: `0x${string}`;
}

@Controller('alchemy')
export class AlchemyNotifyController {
  constructor(private readonly alchemyNotify: AlchemyNotifyService) {}

  @Post('register-wallet')
  async registerWallet(@Body() body: RegisterWalletDto) {
    // TODO: 여기서 요청 보낸 사용자가 실제 이 address의 소유자인지
    //       auth/session 기반으로 검증하는 게 좋음.
    if (!body.address) {
      throw new Error('address is required');
    }

    try {
      await this.alchemyNotify.addAddressToWebhook(body.address);
    } catch (err) {
      return { ok: false, err }
    }

    return { ok: true };
  }
}