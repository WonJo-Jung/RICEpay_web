import { Controller, Get, Param, Query, Post, NotFoundException, Body, Ip, Headers, BadRequestException, Inject } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { recoverMessageAddress } from 'viem';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createHash } from 'node:crypto';
import { isAllowedChainId, isAllowedOrigin } from '../common/security/guards';

type BaseSigDto = {
  address: string;           // 0x..
  signature: `0x${string}`;  // personal_sign 결과
  exp: number;               // epoch seconds (짧게)
  nonce: string;             // /auth/nonce에서 받은 값
  origin: string;            // window.location.host (또는 클라에서 명시)
  chainId: number;           // wagmi/지갑에서
};

type IssueDto = BaseSigDto;
type RevokeDto = BaseSigDto & {
  expectedToken?: string;   // 선택: 클라이언트가 현재 보고 있는 토큰(스테일 보호)
  dryRun?: boolean;         // 선택: 미리보기(변경 없음)
};

const DURATION = Number(process.env.VALID_SIGNITURE_DURATION_S!);

@Controller()
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService, @Inject(CACHE_MANAGER) private cache: Cache,) {}

  private async consumeNonce(nonce: string) {
    const key = `nonce:${nonce}`;
    const existed = await this.cache.get(key);
    if (!existed) throw new BadRequestException('nonce invalid/used');
    await this.cache.del(key); // 즉시 소모
  }

  private async rejectIfSignatureReused(sig: string) {
    const digest = createHash('sha256').update(sig).digest('hex');
    const key = `sig:${digest}`;
    const existed = await this.cache.get(key);
    if (existed) throw new BadRequestException('signature replayed');
    // 2분만 재사용 금지 (exp와 비슷한 수준)
    await this.cache.set(key, '1', 120 * 1000);
  }

  @Get('activity')
  activity(
    @Query('address') address?: string,
    @Query('chainId') chainId?: string,
    @Query('direction') direction?: 'SENT' | 'RECEIVED',
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.receipts.listActivity({
      address,
      chainId: chainId ? Number(chainId) : undefined,
      direction,
      cursor,
      limit: limit ? Number(limit) : undefined,
      from,
      to,
    });
  }

  @Get('receipts/:id')
  async receipt(@Param('id') id: string) {
    const r = await this.receipts.getById(id);
    if (!r) throw new NotFoundException('receipt not found');
    return r;
  }

  @Get('receipts/share/:token')
  async receiptByToken(@Param('token') token: string) {
    const r = await this.receipts.getByShareToken(token);
    if (!r) throw new NotFoundException('receipt not found');
    return r;
  }

  // 공유 토큰 발급/멱등/회전
  @Post('receipts/:id/share')
  async issueShare(
    @Param('id') id: string,
    @Query('force') force: string,
    @Body() body: IssueDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    const { address, signature, exp, nonce, origin, chainId } = body || {};
    if (!address || !signature || !exp || !nonce || !origin || !chainId) {
      throw new BadRequestException('missing address/signature/exp/nonce/origin/chainId');
    }
    if (!isAllowedOrigin(origin)) throw new BadRequestException('origin not allowed');
    if (!isAllowedChainId(chainId)) throw new BadRequestException('chainId not allowed');

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(exp - now) > DURATION) throw new BadRequestException('signature expired');

    // 프론트와 동일 포맷의 메시지여야 함 (엔드포인트+id 바인딩)
    const message = [
      `POST /${process.env.GLOBAL_PREFIX!}/receipts/${id}/share`,
      `origin=${origin}`,
      `chainId=${chainId}`,
      `nonce=${nonce}`,
      `exp=${exp}`,
    ].join('\n');

    let recovered: string;
    try {
      recovered = (await recoverMessageAddress({ message, signature })).toLowerCase();
    } catch {
      throw new BadRequestException('invalid signature');
    }
    if (recovered !== address.toLowerCase()) {
      throw new BadRequestException('address/signature mismatch');
    }
    await this.consumeNonce(nonce);
    await this.rejectIfSignatureReused(signature);

    // ensureShareToken 내부에서 from/to와 recovered 주소 매칭(소유자 인가)
    const token = await this.receipts.ensureShareToken(
      id,
      { userId: undefined, addresses: [recovered], ip, ua },
      { forceRotate: force === '1' },
    );
    return { token };
  }

  // 🔒 공유 토큰 회수(무효화)
  @Post('receipts/:id/share/revoke')
  async revokeShare(
    @Param('id') id: string,
    @Body() body: RevokeDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    const { address, signature, exp, nonce, origin, chainId, expectedToken, dryRun } = body || {};
    if (!address || !signature || !exp || !nonce || !origin || !chainId) {
      throw new BadRequestException('missing address/signature/exp/nonce/origin/chainId');
    }
    if (!isAllowedOrigin(origin)) throw new BadRequestException('origin not allowed');
    if (!isAllowedChainId(chainId)) throw new BadRequestException('chainId not allowed');

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(exp - now) > DURATION) {
      throw new BadRequestException('signature expired');
    }

    // ✅ 서명 메시지: revoke 엔드포인트 + (선택) expectedToken 바인딩 + exp
    //   - 토큰 바인딩을 하면 재사용/오용을 더 강하게 차단
    const message = [
      `POST /${process.env.GLOBAL_PREFIX!}/receipts/${id}/share/revoke`,
      expectedToken ? `token=${expectedToken}` : null,
      `origin=${origin}`,
      `chainId=${chainId}`,
      `nonce=${nonce}`,
      `exp=${exp}`,
    ].filter(Boolean).join('\n');

    let recovered: string;
    try {
      recovered = (await recoverMessageAddress({ message, signature })).toLowerCase();
    } catch {
      throw new BadRequestException('invalid signature');
    }
    if (recovered !== address.toLowerCase()) {
      throw new BadRequestException('address/signature mismatch');
    }
    await this.consumeNonce(nonce);
    await this.rejectIfSignatureReused(signature);

    // 서비스 호출: 경쟁상태 안전 + 조건부 회수 + 감사 메타
    const res = await this.receipts.revokeShareToken(
      id,
      { userId: undefined, addresses: [recovered], ip, ua },
      { expectedToken, dryRun },
    );

    return res; // { revoked: boolean; reason: 'revoked' | 'noop' | 'stale'; currentToken: string | null }
  }
}