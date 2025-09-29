import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { prisma } from '../lib/db';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.ALCHEMY_RPC_URL!),
});

const CLEAN_CRON = process.env.TX_CLEAN_CRON ?? '0 3 * * *';
const CLEAN_MAX = Number(process.env.TX_CLEAN_MAX ?? 200);
const PENDING_MAX_MIN = Number(process.env.TX_CLEAN_PENDING_MAX_MINUTES ?? 60);

// 상태 상수 (스키마는 String이므로 문자열 사용)
const STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  DROPPED_REPLACED: 'DROPPED_REPLACED',
  EXPIRED: 'EXPIRED', // 새로 추가
} as const;

@Injectable()
export class TxCleanupCron {
  private readonly log = new Logger(TxCleanupCron.name);

  // 매일 03:00 (@Cron() 데코레이터는 node-cron 포맷 문자열을 지원하므로, 환경변수로 주입한 문자열을 그대로 넘기면 됨. 간단히 매일 3시에 고정)
  @Cron(CLEAN_CRON)
  async cleanupStalePending() {
    this.log.log(`Start cleanup stale pending (max=${CLEAN_MAX}, age>=${PENDING_MAX_MIN}m)`);

    const ageThreshold = new Date(Date.now() - PENDING_MAX_MIN * 60_000);

    // 1) 오래된 PENDING들 가져오기
    const targets = await prisma.transaction.findMany({
      where: {
        status: STATUS.PENDING,
        createdAt: { lt: ageThreshold },
      },
      take: CLEAN_MAX,
      orderBy: { createdAt: 'asc' },
    });

    this.log.log(`Found ${targets.length} stale PENDING txs`);

    // 현재 헤드 (확인 수 계산에 사용)
    const headBN = Number(await client.getBlockNumber()).valueOf?.() ?? Number(await client.getBlockNumber());

    for (const t of targets) {
      try {
        // 2) 영수증 조회
        const receipt = await client.getTransactionReceipt({ hash: t.txHash as `0x${string}` });

        const bn = Number(receipt.blockNumber);
        const conf = Math.max(headBN - bn + 1, 1);
        const ok = receipt.status === 'success';

        // 3) 성공/실패로 정정
        await prisma.transaction.update({
          where: { txHash: t.txHash },
          data: {
            status: ok ? STATUS.CONFIRMED : STATUS.FAILED,
            blockNumber: bn,
            confirmations: conf,
          },
        });
        this.log.log(`Rectified ${t.txHash}: ${ok ? 'CONFIRMED' : 'FAILED'} (bn=${bn}, conf=${conf})`);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        // 4) 영수증 없음 → 체인에 미반영/가짜/다른 네트워크로 간주 → EXPIRED 마킹
        if (msg.includes('TransactionReceiptNotFoundError')) {
          await prisma.transaction.update({
            where: { txHash: t.txHash },
            data: { status: STATUS.EXPIRED },
          });
          this.log.warn(`Expired ${t.txHash}: no receipt after ${PENDING_MAX_MIN}m`);
        } else {
          // RPC 일시 오류 등 → 건너뛰고 다음 번 배치에서 재시도
          this.log.warn(`Skip ${t.txHash}: ${msg}`);
        }
      }
    }

    this.log.log(`Cleanup done`);
  }
}