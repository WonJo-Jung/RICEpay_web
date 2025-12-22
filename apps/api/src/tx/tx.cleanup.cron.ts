import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Chain, Client, createPublicClient, http, HttpTransport, PublicClient, Transport } from 'viem';
import { prisma } from '../lib/db';
import { chains } from '../lib/viem';

const CLEAN_CRON = process.env.TX_CLEAN_CRON ?? '*/15 * * * *';
const CLEAN_MAX = Number(process.env.TX_CLEAN_MAX ?? 20);
const PENDING_MAX_MIN = Number(process.env.TX_CLEAN_PENDING_MAX_MINUTES ?? 30);
type AnyPublicClient = Client<Transport, Chain>;

// 상태 상수 (스키마는 String이므로 문자열 사용)
const STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  DROPPED_REPLACED: 'DROPPED_REPLACED',
  EXPIRED: 'EXPIRED', // 새로 추가
} as const;

function makeClients() {
  const map: Record<number, PublicClient<HttpTransport, Chain>> = {};
  for (const c of Object.values(chains)) {
    // 체인별 RPC를 환경변수에서 꺼냄
    const rpc = c.rpcUrls.default.http[0]
    if (!rpc) {
      throw new BadRequestException(`Missing RPC for chain ${c.id}`);
    }
    map[c.id] = createPublicClient({
      chain: c,
      transport: http(rpc),
    }) as AnyPublicClient;
  }
  return map;
}

@Injectable()
export class TxCleanupCron {
  private readonly log = new Logger(TxCleanupCron.name);
  private readonly clients = makeClients();

  // 매 15분마다 (@Cron() 데코레이터는 node-cron 포맷 문자열을 지원하므로, 환경변수로 주입한 문자열을 그대로 넘기면 됨.)
  @Cron(CLEAN_CRON)
  async cleanupStalePending() {
    this.log.log(`Start cleanup stale pending (max=${CLEAN_MAX}, age>=${PENDING_MAX_MIN}m)`);

    const ageThreshold = new Date(Date.now() - PENDING_MAX_MIN * 60_000);

    // 1) 오래된 PENDING들 가져오기 (모든 체인 대상)
    const targets = await prisma.transaction.findMany({
      where: {
        status: STATUS.PENDING,
        createdAt: { lt: ageThreshold },
      },
      take: CLEAN_MAX,
      orderBy: { createdAt: 'asc' },
    });

    this.log.log(`Found ${targets.length} stale PENDING txs`);

    // 2) 체인별 그룹핑
    const grouped = new Map<number, typeof targets>();
    for (const t of targets) {
      const cid = t.chainId; // 방어적 기본값(가능하면 제거)
      if (!grouped.has(cid)) grouped.set(cid, []);
      grouped.get(cid)!.push(t);
    }

    // 3) 체인별 처리 (헤드 조회 → 각 tx 검사)
    for (const [chainId, list] of grouped) {
      const client = this.clients[chainId];
      if (!client) {
        this.log.warn(`No client for chain ${chainId}, skip ${list.length} txs`);
        continue;
      }

      // 현재 헤드 (확인 수 계산에 사용)
      const headBN = Number(await client.getBlockNumber());
      this.log.log(`Found Chain ${chainId}: head=${headBN}, txs=${list.length} txs to cleanup`);
  
      for (const t of list) {
        try {
          // 2) 영수증 조회
          const receipt = await client.getTransactionReceipt({ hash: t.txHash as `0x${string}` });
  
          const bn = Number(receipt.blockNumber);
          const conf = Math.max(headBN - bn + 1, 1);
          const ok = receipt.status === 'success';
  
          // 3) 성공/실패로 정정
          await prisma.transaction.update({
            where: { txHash: t.txHash, chainId },
            data: {
              status: ok ? STATUS.CONFIRMED : STATUS.FAILED,
              blockNumber: bn,
              confirmations: conf,
            },
          });
          this.log.log(`Rectified [${chainId}] ${t.txHash}: ${ok ? 'CONFIRMED' : 'FAILED'} (bn=${bn}, conf=${conf})`);
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          // 4) 영수증 없음 → 체인에 미반영/가짜/다른 네트워크로 간주 → EXPIRED 마킹
          if (msg.includes('TransactionReceiptNotFoundError')) {
            await prisma.transaction.update({
              where: { txHash: t.txHash, chainId },
              data: { status: STATUS.EXPIRED },
            });
            this.log.warn(`Expired [${chainId}] ${t.txHash}: no receipt after ${PENDING_MAX_MIN}m`);
          } else {
            // RPC 일시 오류 등 → 건너뛰고 다음 번 배치에서 재시도
            this.log.warn(`Skip [${chainId}] ${t.txHash}: ${msg}`);
          }
        }
      }
    }

    this.log.log(`Cleanup done`);
  }
}