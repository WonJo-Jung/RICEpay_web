import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { TxService } from '../tx/tx.service';
import { verifyAlchemySignature } from '../common/verify-alchemy-signature';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.CHAIN_BASE_SEPOLIA_RPC!), // ex: https://base-sepolia.g.alchemy.com/v2/<KEY>
});

@Controller('/webhooks/alchemy')
export class AlchemyWebhookController {
  constructor(private tx: TxService) {}

  @Post()
  async handle(
    @Req() req: any,
    @Headers('x-alchemy-signature') signature: string,
    @Body() payload: any,
  ) {
    const secret = process.env.ALCHEMY_WEBHOOK_SECRET!;
    const raw = req.rawBody; // ✅ raw 그대로 (toString 금지)
    if (!verifyAlchemySignature(raw, signature, secret)) {
      throw new UnauthorizedException('Bad signature');
    }

    // 1) 해시 수집 (Address Activity / Mined Tx / 기타)
    const hashes = extractHashes(payload);
    if (hashes.length === 0) {
      return { ok: true, reason: 'no-hash-in-payload' };
    }

    // 2) 상태/메타 추출
    const status = extractStatus(payload); // 'CONFIRMED' | 'FAILED' | 'DROPPED_REPLACED'
    let { blockNumber, confirmations, eventId } = extractMeta(payload);

    // 3) 컨펌 수가 없고, 블록번호가 있으면 계산(확정 시 1+)
    if (status === 'CONFIRMED' && blockNumber != null && confirmations == null) {
      try {
        const head = await publicClient.getBlockNumber();
        const computed = Number(head) - Number(blockNumber) + 1;
        confirmations = Math.max(computed, 1);
      } catch {
        // RPC 실패는 무시 (나중에 배치로 보강 가능)
      }
    }

    // 4) 여러 해시에 대해 idempotent 업데이트
    for (const h of hashes) {
      await this.tx.applyWebhookUpdate({
        eventId: eventId ?? `evt-${h}-${Date.now()}`,
        txHash: h, // 소문자 정규화는 서비스에서 처리
        status,
        blockNumber: blockNumber ?? undefined,
        confirmations: confirmations ?? undefined,
        rawPayload: payload ?? undefined, // 크면 저장 안 함(원하면 payload 넣기)
      });
    }

    // ✅ Nest 기본 201이 아니라 200으로 내려가도록
    return { ok: true };
  }
}

/** Address Activity / Mined Tx 등 다양한 경로에서 tx hash 추출 */
function extractHashes(p: any): `0x${string}`[] {
  const out = new Set<string>();

  // Address Activity: event.activity[]
  const act = p?.event?.activity;
  if (Array.isArray(act)) {
    for (const a of act) {
      // a.hash or a.transactionHash 둘 다 대비
      if (a?.hash) out.add(String(a.hash));
      if (a?.transactionHash) out.add(String(a.transactionHash));
      // 일부 경우 log.transactionHash에만 존재
      if (a?.log?.transactionHash) out.add(String(a.log.transactionHash));
    }
  }

  // Mined Tx / 기타 변형
  if (p?.event?.transaction?.hash) out.add(String(p.event.transaction.hash));
  if (p?.event?.data?.transaction?.hash) out.add(String(p.event.data.transaction.hash));
  if (p?.data?.transaction?.hash) out.add(String(p.data.transaction.hash));
  if (p?.hash) out.add(String(p.hash));

  // 소문자 정규화 + 0x로 시작하는 것만
  return [...out]
    .map(h => h.toLowerCase())
    .filter(h => /^0x[0-9a-f]{64}$/.test(h)) as `0x${string}`[];
}

const hexToNum = (h?: string) => (h ? Number(BigInt(h)) : undefined);

function extractMeta(p: any) {
  const eventId = p?.event?.eventId ?? p?.id;

  // 1) 우선순위대로 blockNumber를 찾고(hex → number 변환)
  const blockNumber =
    p?.event?.block?.number ??
    p?.data?.blockNumber ??
    hexToNum(p?.event?.activity?.[0]?.log?.blockNumber);

  // 2) confirmations는 있으면 쓰고, 없으면 null (B안에서 계산 가능)
  const confirmations =
    p?.event?.confirmations ??
    undefined;

  return { eventId, blockNumber, confirmations };
}

function extractStatus(p: any): 'CONFIRMED' | 'FAILED' | 'DROPPED_REPLACED' {
  // 기본 CONFIRMED
  if (p?.event?.type === 'DROPPED_REPLACED') return 'DROPPED_REPLACED';
  const tx = p?.event?.transaction ?? p?.transaction ?? p?.data?.transaction;
  if (tx?.status === 'failed' || p?.status === 'failed') return 'FAILED';
  return 'CONFIRMED';
}