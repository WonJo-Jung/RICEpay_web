// push.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class PushService {
  private expo = new Expo();
  private readonly logger = new Logger(PushService.name);

  async sendToDevices(params: {
    devices: { pushToken: string }[];
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    const messages: ExpoPushMessage[] = [];

    for (const d of params.devices) {
      if (!Expo.isExpoPushToken(d.pushToken)) {
        this.logger.warn(`Invalid Expo push token: ${d.pushToken}`);
        continue;
      }

      messages.push({
        to: d.pushToken,
        sound: 'default',
        title: params.title,
        body: params.body,
        data: params.data,
      });
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        this.logger.log(`Expo push tickets: ${JSON.stringify(tickets)} at ${new Date().toISOString()}`)
      } catch (err) {
        this.logger.error('Error sending push', err as any);
      }
    }
  }
}
