import { Injectable } from '@nestjs/common';
import { prisma } from '../lib/db';
import { Prisma } from '@prisma/client';
import crypto from 'node:crypto';

type CreateReceiptInput = {
  transactionId: string;
  chainId: number;
  network: string;
  txHash: string;
  direction: 'SENT' | 'RECEIVED';
  token: string;
  amount: string;           // decimal string
  fiatCurrency: 'USD';
  fiatRate: string;         // decimal string
  gasPaid?: string;
  gasFiatAmount?: string;
  appFee?: string;
  appFeeFiat?: string;
  policyVersion: string;
  fromAddress: string;
  toAddress: string;
  submittedAt: Date;
  confirmedAt: Date;
  snapshot?: Record<string, unknown>;
};

@Injectable()
export class ReceiptService {
  async createSnapshot(input: CreateReceiptInput) {
    // 멱등: transactionId 유니크 전제
    return prisma.receipt.upsert({
      where: { transactionId: input.transactionId },
      create: {
        ...input,
        // 간단 계산(정밀 필요하면 decimal lib 사용)
        fiatAmount: (Number(input.amount) * Number(input.fiatRate)).toString(),
        snapshot: (input.snapshot ?? {}) as Prisma.InputJsonValue,
      },
      update: {}, // 이미 있으면 갱신 안 함
    });
  }

  async getById(id: string) {
    return prisma.receipt.findUnique({ where: { id } });
  }

  async getByShareToken(token: string) {
    return prisma.receipt.findUnique({ where: { shareToken: token } });
  }

  async ensureShareToken(id: string) {
    const token = crypto.randomUUID().replace(/-/g, '');
    const r = await prisma.receipt.update({ where: { id }, data: { shareToken: token } });
    return r.shareToken!;
  }

  async listActivity(params: {
    address?: string;
    chainId?: number;
    direction?: 'SENT' | 'RECEIVED';
    cursor?: string;
    limit?: number;
    from?: string;
    to?: string;
  }) {
    const take = Math.min(params.limit ?? 20, 100);
    const where: any = {};
    if (params.address) where.OR = [{ fromAddress: params.address }, { toAddress: params.address }];
    if (params.chainId) where.chainId = params.chainId;
    if (params.direction) where.direction = params.direction;
    if (params.from || params.to) {
      where.confirmedAt = {};
      if (params.from) where.confirmedAt.gte = new Date(params.from);
      if (params.to) where.confirmedAt.lte = new Date(params.to);
    }

    const rows = await prisma.receipt.findMany({
      where,
      orderBy: { confirmedAt: 'desc' },
      take: take + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }
}