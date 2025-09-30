import { Controller, Get, Param, Query, Post, NotFoundException, Req, Body, Ip, Headers, BadRequestException } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { recoverMessageAddress } from 'viem';

type ShareSigDto = {
  address: string;          // 사용자가 주장하는 지갑 주소 (0x..)
  signature: `0x${string}`; // personal_sign 결과
  exp: number;              // epoch seconds (짧게 60s 권장)
};

type RevokeSigDto = {
  address: string;          // 0x...
  signature: `0x${string}`; // personal_sign 결과
  exp: number;              // epoch seconds (짧게)
  expectedToken?: string;   // 선택: 클라이언트가 현재 보고 있는 토큰(스테일 보호)
  dryRun?: boolean;         // 선택: 미리보기(변경 없음)
};

const DURATION = Number(process.env.VALID_SIGNITURE_DURATION_S!);

@Controller()
export class ReceiptController {
  constructor(private receipts: ReceiptService) {}

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
    @Body() body: ShareSigDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    const address = body?.address?.toLowerCase();
    const signature = body?.signature;
    const exp = Number(body?.exp);

    if (!address || !signature || !exp) {
      throw new BadRequestException('missing address/signature/exp');
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(exp - now) > DURATION) {
      throw new BadRequestException('signature expired');
    }

    // 프론트와 동일 포맷의 메시지여야 함 (엔드포인트+id 바인딩)
    const message = `POST /v1/receipts/${id}/share\nexp=${exp}`;

    let recovered: string;
    try {
      recovered = (await recoverMessageAddress({ message, signature })).toLowerCase();
    } catch {
      throw new BadRequestException('invalid signature');
    }
    if (recovered !== address) {
      throw new BadRequestException('address/signature mismatch');
    }

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
    @Body() body: RevokeSigDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    const address = body?.address?.toLowerCase();
    const signature = body?.signature;
    const exp = Number(body?.exp);
    const expectedToken = body?.expectedToken; // ← 추가
    const dryRun = !!body?.dryRun;             // ← 추가

    if (!address || !signature || !exp) {
      throw new BadRequestException('missing address/signature/exp');
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(exp - now) > DURATION) {
      throw new BadRequestException('signature expired');
    }

    // ✅ 서명 메시지: revoke 엔드포인트 + (선택) expectedToken 바인딩 + exp
    //   - 토큰 바인딩을 하면 재사용/오용을 더 강하게 차단
    const messageLines = [
      `POST /v1/receipts/${id}/share/revoke`,
      expectedToken ? `token=${expectedToken}` : null,
      `exp=${exp}`,
    ].filter(Boolean);
    const message = messageLines.join('\n');

    let recovered: string;
    try {
      recovered = (await recoverMessageAddress({ message, signature })).toLowerCase();
    } catch {
      throw new BadRequestException('invalid signature');
    }
    if (recovered !== address) {
      throw new BadRequestException('address/signature mismatch');
    }

    // 서비스 호출: 경쟁상태 안전 + 조건부 회수 + 감사 메타
    const res = await this.receipts.revokeShareToken(
      id,
      { userId: undefined, addresses: [recovered], ip, ua },
      { expectedToken, dryRun },
    );

    return res; // { revoked: boolean; reason: 'revoked' | 'noop' | 'stale'; currentToken: string | null }
  }
}