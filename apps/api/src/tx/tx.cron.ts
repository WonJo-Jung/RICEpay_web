import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const prisma = new PrismaClient();

// RPC 클라이언트 (Base Sepolia)
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.CHAIN_BASE_SEPOLIA_RPC!),
});

const CRON = process.env.TX_BACKFILL_CRON ?? '0 2 * * *'; // 기본 02:00 매일
const MAX = Number(process.env.TX_BACKFILL_MAX ?? 200);
const TARGET = Number(process.env.TX_BACKFILL_CONFIRM_TARGET ?? 6);

@Injectable()
export class TxCron {
  private readonly log = new Logger(TxCron.name);

  // Note: @Cron은 데코레이터에 상수를 넣어야 해서, 아주 간단히 “매 분”으로 열고 내부에서
  // CRON 매칭 체크를 하거나, 아래처럼 가장 가까운 표준식으로 사용 가능합니다.
  // 간단히 밤 2시에만 돌리고 싶으면 CronExpression.EVERY_DAY_AT_2AM 사용.
  @Cron(CRON)
  async backfillConfirmations() {
    // 커스텀 CRON을 쓰고 싶으면 위 데코레이터 대신 node-cron이나
    // 다른 스케줄러로 대체하거나, 여기서 환경변수와 현재 시간을 비교해도 됩니다.
    if (CRON !== '0 2 * * *') {
      // 환경에서 다른 주기를 지정한 경우에도 그냥 즉시 실행하도록 유지 (간단 버전)
      // 복잡한 커스텀 CRON 파싱이 필요하면 node-cron 사용 고려
    }

    this.log.log(`Start backfill (max=${MAX}, target=${TARGET})`);
    const head = Number(await client.getBlockNumber());

    // 대상: CONFIRMED인데 confirmations이 null이거나 낮은 것
    const targets = await prisma.transaction.findMany({
      where: {
        status: 'CONFIRMED',
        OR: [{ confirmations: null }, { confirmations: { lt: TARGET } }],
      },
      take: MAX,
      orderBy: { updatedAt: 'asc' },
    });

    this.log.log(`Found ${targets.length} txs to backfill`);

    for (const t of targets) {
      try {
        // 블록번호가 없으면 receipt로 채움
        const receipt = await client.getTransactionReceipt({ hash: t.txHash as `0x${string}` });
        const bn = Number(receipt.blockNumber);
        const conf = Math.max(head - bn + 1, 1);

        // 증가하는 방향으로만 업데이트 (감소는 하지 않음)
        const shouldUpdate =
          (t.blockNumber ?? 0) !== bn || (t.confirmations ?? 0) < conf;

        if (shouldUpdate) {
          await prisma.transaction.update({
            where: { txHash: t.txHash },
            data: {
              blockNumber: bn,
              confirmations: conf,
            },
          });
          this.log.debug(`Updated ${t.txHash}: bn=${bn}, conf=${conf}`);
        }
      } catch (e) {
        // 영수증 조회 실패(아직 체인 반영이 덜 됐거나, RPC 일시 오류) → 건너뜀
        this.log.warn(`Skip ${t.txHash}: ${String(e)}`);
      }
    }

    this.log.log(`Backfill done`);
  }
}