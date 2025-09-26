import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { TxRecord } from '@ricepay/shared';
import { TxStream } from './tx.stream';

const prisma = new PrismaClient();

const norm = (h: string) => h.toLowerCase() as `0x${string}`;

@Injectable()
export class TxService {
  constructor(private stream: TxStream) {}

  async upsertPending(dto: {
    txHash: string; from: string; to: string;
    token?: string; amount?: string; chainId: number;
  }): Promise<TxRecord> {
    const txHash = norm(dto.txHash);
    const rec = await prisma.transaction.upsert({
      where: { txHash },
      update: {
        from: dto.from,
        to: dto.to,
        token: dto.token ?? null,
        amount: dto.amount ?? null,
      },
      create: {
        txHash,
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
    const rec = await prisma.transaction.findUnique({
      where: { txHash: norm(txHash) },
    });
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
    const txHash = norm(input.txHash);

    // idempotency by eventId (DB에도 UNIQUE 인덱스 권장)
    const existed = await prisma.transaction.findFirst({
      where: { lastEventId: input.eventId },
    });
    if (existed) return this.toTxRecord(existed);

    // 우선 업데이트 시도
    let updated = await prisma.transaction.update({
      where: { txHash },
      data: {
        status: input.status,
        blockNumber: input.blockNumber ?? null,
        confirmations: input.confirmations ?? null,
        lastEventId: input.eventId,
        rawPayload: input.rawPayload as any,
      },
    }).catch(() => null);

    // 등록이 없었던 경우(웹훅이 먼저 온 케이스) 보완: upsert 성격으로 create
    if (!updated) {
      updated = await prisma.transaction.upsert({
        where: { txHash },
        update: {
          status: input.status,
          blockNumber: input.blockNumber ?? null,
          confirmations: input.confirmations ?? null,
          lastEventId: input.eventId,
          rawPayload: input.rawPayload as any,
        },
        create: {
          txHash,
          from: '0x0000000000000000000000000000000000000000', // 알 수 없으면 placeholder
          to:   '0x0000000000000000000000000000000000000000',
          token: null,
          amount: null,
          chainId: 84532, // 또는 payload/환경에서 추론
          network: 'BASE_SEPOLIA',
          status: input.status,
          blockNumber: input.blockNumber ?? null,
          confirmations: input.confirmations ?? null,
          lastEventId: input.eventId,
          rawPayload: input.rawPayload as any,
        },
      });
    }

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