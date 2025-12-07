// alchemy.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AlchemyNotifyService {
  private readonly logger = new Logger(AlchemyNotifyService.name);
  private readonly baseUrl = 'https://dashboard.alchemy.com/api';

  private get authToken() {
    const token = process.env.ALCHEMY_AUTH_TOKEN;
    if (!token) throw new Error('ALCHEMY_AUTH_TOKEN is not set');
    return token;
  }

  private get webhookId() {
    const id = process.env.ALCHEMY_WEBHOOK_ID;
    if (!id) throw new Error('ALCHEMY_WEBHOOK_ID is not set');
    return id;
  }

  /**
   * 신규/기존 지갑 주소를 Address Activity webhook에 등록
   * - 같은 주소를 여러 번 호출해도 안전 (idempotent)
   */
  async addAddressToWebhook(address: `0x${string}`) {
    const normalized = address.toLowerCase(); // 대소문자 통일 (선택)

    try {
      await axios.patch(
        `${this.baseUrl}/update-webhook-addresses`,
        {
          webhook_id: this.webhookId,
          addresses_to_add: [normalized],
          addresses_to_remove: [],
        },
        {
          headers: {
            'X-Alchemy-Token': this.authToken,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `[AlchemyNotify] successfully registered ${normalized} to webhook`,
      );
    } catch (err: any) {
      this.logger.error(
        `[AlchemyNotify] failed to register ${normalized} to webhook: ${err?.response?.status} ${err?.response?.data ? JSON.stringify(err.response.data) : err.message}`,
      );
      throw err;
    }
  }
}