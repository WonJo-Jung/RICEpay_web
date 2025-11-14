// notifications.service.ts
import { Injectable } from '@nestjs/common';
import { PushService } from '../push/push.service';
import { prisma } from "../lib/db";

interface CreateNotificationInput {
  wallet: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly pushService: PushService,
  ) {}

  async createAndSend(input: CreateNotificationInput) {
    const { wallet, type, title, body, data } = input;

    const notification = await prisma.notification.create({
      data: {
        wallet,
        type,
        title,
        body,
        data,
      },
    });

    // 해당 wallet에 등록된 디바이스들 조회
    const devices = await prisma.device.findMany({
      where: { wallet },
    });

    if (devices.length > 0) {
      await this.pushService.sendToDevices({
        devices,
        title,
        body,
        data: { ...data, notificationId: notification.id },
      });
    }

    return notification;
  }

  async listForWallet(wallet: string) {
    return prisma.notification.findMany({
      where: { wallet },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async unreadNoti(wallet: string): Promise<number> {
    if (!wallet) return 0;

    return prisma.notification.count({
      where: {
        wallet,
        isRead: false,
      },
    });
  }
}