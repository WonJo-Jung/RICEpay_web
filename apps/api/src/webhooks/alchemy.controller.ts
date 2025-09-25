import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { TxService } from '../tx/tx.service';
import { verifyAlchemySignature } from '../common/verify-alchemy-signature';

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
    const raw = req.rawBody?.toString?.() ?? JSON.stringify(payload);
    if (!verifyAlchemySignature(raw, signature, secret)) {
      throw new UnauthorizedException('Bad signature');
    }

    // 아래 매핑은 Base Sepolia “tx / log” 기준 최소 구현 예
    const eventId: string = payload?.event?.eventId ?? payload?.id ?? cryptoRandom();
    const txHash: string | undefined =
      payload?.event?.transaction?.hash ??
      payload?.event?.data?.transaction?.hash ??
      payload?.data?.transaction?.hash;

    if (!txHash) return { ok: true, reason: 'no-tx-hash' };

    // 상태 판정 (알케미 payload 스키마에 맞춰 커스터마이즈)
    let status: 'CONFIRMED'|'FAILED'|'DROPPED_REPLACED' = 'CONFIRMED';
    if (payload?.event?.transaction?.status === 'failed') status = 'FAILED';
    if (payload?.event?.type === 'DROPPED_REPLACED') status = 'DROPPED_REPLACED';

    const blockNumber = payload?.event?.block?.number ?? payload?.data?.blockNumber ?? undefined;
    const confirmations = payload?.event?.confirmations ?? undefined;

    await this.tx.applyWebhookUpdate({
      eventId,
      txHash,
      status,
      blockNumber,
      confirmations,
      rawPayload: payload,
    });

    return { ok: true };
  }
}

// 간단 UUID 대체
function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}