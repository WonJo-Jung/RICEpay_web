import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { TxRecord } from '@ricepay/shared';
import { TxStream } from './tx.stream';

const prisma = new PrismaClient();

@Injectable()
export class TxService {
  constructor(private stream: TxStream) {}

  async upsertPending(dto: {
    txHash: string; from: string; to: string;
    token?: string; amount?: string; chainId: number;
  }): Promise<TxRecord> {
    const rec = await prisma.transaction.upsert({
      where: { txHash: dto.txHash },
      update: {
        from: dto.from, to: dto.to, token: dto.token ?? null, amount: dto.amount ?? null,
      },
      create: {
        txHash: dto.txHash,
        from: dto.from,
        to: dto.to,
        token: dto.token ?? null,
        amount: dto.amount ?? null,
        chainId: dto.chainId,
        network: 'BASE_SEPOLIA',
        status: 'PENDING',
      },
    });
    const tx = this.toTxRecord(rec);
    this.stream.push(tx);
    return tx;
  }

  async findByHash(txHash: string): Promise<TxRecord | null> {
    const rec = await prisma.transaction.findUnique({ where: { txHash } });
    return rec ? this.toTxRecord(rec) : null;
  }

  async applyWebhookUpdate(input: {
    eventId: string;
    txHash: string;
    status: 'CONFIRMED' | 'FAILED' | 'DROPPED_REPLACED';
    blockNumber?: number;
    confirmations?: number;
    rawPayload?: unknown;
  }): Promise<TxRecord | null> {
    // idempotency (eventId)
    const existed = await prisma.transaction.findFirst({ where: { lastEventId: input.eventId } });
    if (existed) return this.toTxRecord(existed);

    const updated = await prisma.transaction.update({
      where: { txHash: input.txHash },
      data: {
        status: input.status,
        blockNumber: input.blockNumber ?? null,
        confirmations: input.confirmations ?? undefined,
        lastEventId: input.eventId,
        rawPayload: input.rawPayload as any,
      },
    }).catch(() => null);

    if (!updated) return null;
    const tx = this.toTxRecord(updated);
    this.stream.push(tx);
    return tx;
  }

  private toTxRecord(r: any): TxRecord {
    return {
      id: r.id,
      chainId: r.chainId,
      network: r.network,
      txHash: r.txHash,
      from: r.from,
      to: r.to,
      token: r.token ?? undefined,
      amount: r.amount ?? undefined,
      status: r.status,
      blockNumber: r.blockNumber ?? undefined,
      confirmations: r.confirmations ?? undefined,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}