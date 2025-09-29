import { Injectable } from '@nestjs/common';
import { BASE_SEPOLIA, type TxRecord } from '@ricepay/shared';
import { TxStream } from './tx.stream';
import { ReceiptService } from '../receipt/receipt.service';
import { FxService } from '../fx/fx.service';
import { FeesService } from '../fees/fees.service';
import { prisma } from '../lib/db';

const norm = (h: string) => h.toLowerCase() as `0x${string}`;

@Injectable()
export class TxService {
  constructor(
    private stream: TxStream,
    private fx: FxService,                // DEV-05
    private fees: FeesService,            // DEV-06
    private receipts: ReceiptService,     // DEV-09
  ) {}

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
          chainId: BASE_SEPOLIA.id, // 또는 payload/환경에서 추론
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

    // ===== 확정 분기: Receipt 1회 스냅샷 (멱등) =====
    if (input.status === 'CONFIRMED') {
      const already = await prisma.receipt.findUnique({
        where: { transactionId: tx.id },
        select: { id: true },
      });

      const essentialsReady =
        !!tx.amount && !!tx.token &&
        tx.from !== '0x0000000000000000000000000000000000000000' && tx.to !== '0x0000000000000000000000000000000000000000';

      if (!already && essentialsReady) {
        try {
          const rateUsd = await this.fx.get("USD", "MXN");
          const policyVersion = this.fees.currentPolicyVersion();

          await this.receipts.createSnapshot({
            transactionId: tx.id,
            chainId: tx.chainId,
            network: tx.network,
            txHash: tx.txHash,
            // 비수탁 송금/결제 기능에선 SENT로 고정이나 추후 온/오프램프 및 수탁 기능 확장시
            // fromAddress(송금인) 정보가 없어 RECEIVED로 저장되어야 함
            direction: 'SENT',
            token: tx.token!,
            amount: String(tx.amount),
            fiatCurrency: 'USD',
            fiatRate: String(rateUsd.rate),
            gasPaid: updated.gasPaid ? String(updated.gasPaid) : undefined,
            gasFiatAmount: updated.gasPaid ? String(updated.gasPaid * rateUsd.rate) : undefined,
            appFee: updated.appFee ? String(updated.appFee) : undefined,
            appFeeFiat: updated.appFee ? String(updated.appFee * rateUsd.rate) : undefined,
            policyVersion,
            fromAddress: tx.from,
            toAddress: tx.to,
            submittedAt: updated.createdAt,
            confirmedAt: updated.updatedAt ?? new Date(),
            snapshot: {
              eventId: input.eventId,
              confirmations: input.confirmations ?? null,
              blockNumber: input.blockNumber ?? null,
              appVersion: process.env.APP_VERSION ?? null,
            },
          });
        } catch (e) {
          // 실패 내성: 영수증 생성 실패해도 웹훅 응답은 성공
          // console.warn('receipt snapshot failed', e);
        }
      }
    }

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