import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma } from '../lib/db';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

type CreateReceiptInput = {
  transactionId: string;
  chainId: number;
  chain: string;
  txHash: string;
  direction: 'SENT' | 'RECEIVED';
  token: string;
  amount: string;           // decimal string
  fiatCurrency: 'USD';
  quoteCurrency: 'MXN';
  fiatRate: string;         // decimal string
  gasPaid?: string;
  gasFiatAmount?: string;
  appFee?: string;
  appFeeFiat?: string;
  policyVersion: string;
  fromAddress: string;
  toAddress: string;
  submittedAt: Date;
  confirmedAt: Date;
  shareToken?: string;
  snapshot?: Record<string, unknown>;
};

type Actor = {
  userId?: string;              // 있으면 감사 로그에 남김(선택)
  addresses: string[];          // 호출자의 지갑 주소 목록 (소문자 비교)
  ip?: string;                  // 감사 로그(선택)
  ua?: string;                  // 감사 로그(선택)
};

type EnsureOpts = {
  forceRotate?: boolean;        // true면 기존 토큰이 있어도 새로 발급(회전)
};

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  async createSnapshot(input: CreateReceiptInput) {
    // 멱등: transactionId 유니크 전제
    return prisma.receipt.upsert({
      where: { transactionId: input.transactionId },
      create: {
        ...input,
        // 간단 계산(정밀 필요하면 decimal lib 사용)
        fiatAmount: (Number(input.amount) * Number(input.fiatRate)).toString(),
        snapshot: (input.snapshot ?? {}) as Prisma.InputJsonValue,
      },
      update: {}, // 이미 있으면 갱신 안 함
    });
  }

  async getById(id: string) {
    return prisma.receipt.findUnique({ where: { id } });
  }

  async getByShareToken(token: string) {
    return prisma.receipt.findUnique({ where: { shareToken: token } });
  }

  /**
   * 멱등 + 인가 + 회전 + 감사 로그
   * - 이미 토큰 있으면 그대로 반환
   * - forceRotate=true면 새 토큰으로 교체
   * - 소유자 인가: from/to 중 하나가 actor.addresses에 포함되어야 함
   */
  async ensureShareToken(id: string, actor: Actor, opts?: EnsureOpts): Promise<string> {
    const rec = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, shareToken: true, fromAddress: true, toAddress: true },
    });
    if (!rec) throw new NotFoundException('receipt not found');

    this.assertOwnerByAddress(rec.fromAddress, rec.toAddress, actor.addresses);

    // 이미 있으면 그대로 반환 (멱등)
    if (!opts?.forceRotate && rec.shareToken) {
      await this.audit('REUSE', rec.id, actor, { shareToken: rec.shareToken });
      return rec.shareToken;
    }

    const newToken = randomUUID().replace(/-/g, '');

    if (opts?.forceRotate) {
      // 강제 회전: 무조건 새 토큰으로 교체
      const updated = await prisma.receipt.update({
        where: { id: rec.id },
        data: { shareToken: newToken },
        select: { shareToken: true },
      });
      await this.audit('ROTATE', rec.id, actor, { shareToken: updated.shareToken });
      return updated.shareToken!;
    }

    // 일반 발급: 레이스 세이프(비어있을 때만 세팅)
    const res = await prisma.receipt.updateMany({
      where: { id: rec.id, shareToken: null },
      data: { shareToken: newToken },
    });

    if (res.count === 0) {
      // 경쟁 상태: 다른 요청이 먼저 채웠음 → 재조회 후 REUSE로 기록
      const again = await prisma.receipt.findUnique({
        where: { id: rec.id },
        select: { shareToken: true },
      });
      if (!again?.shareToken) throw new Error('failed to ensure share token');
      await this.audit('REUSE', rec.id, actor, { shareToken: again.shareToken });
      return again.shareToken;
    }

    await this.audit('ISSUE', rec.id, actor, { shareToken: newToken });
    return newToken;
  }

  /**
   * 토큰 회수(무효화).
   * - 멱등: 이미 null이면 NOOP
   * - 인가: from/to 중 하나가 actor.addresses에 포함되어야 함
   * - 경쟁 안전: 조건부 updateMany로 처리
   * - stale 보호: expectedToken이 있으면 그 토큰과 일치할 때만 회수
   */
  async revokeShareToken(
    id: string,
    actor: Actor,
    opts?: { expectedToken?: string; dryRun?: boolean },
  ): Promise<{ revoked: boolean; reason: 'revoked' | 'noop' | 'stale'; currentToken: string | null }> {
    const rec = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, fromAddress: true, toAddress: true, shareToken: true },
    });
    if (!rec) throw new NotFoundException('receipt not found');

    // ✅ 소유자 인가
    this.assertOwnerByAddress(rec.fromAddress, rec.toAddress, actor.addresses);

    // 현재 토큰 없음 -> 멱등 NOOP
    if (!rec.shareToken) {
      await this.audit('REVOKE_NOOP', rec.id, actor, { reason: 'already_null' });
      return { revoked: false, reason: 'noop', currentToken: null };
    }

    // 옵션: stale 보호 — 사용자가 보고 있는(기대한) 토큰과 다르면 회수하지 않음
    if (opts?.expectedToken && opts.expectedToken !== rec.shareToken) {
      await this.audit('REVOKE_STALE', rec.id, actor, {
        expectedToken: opts.expectedToken,
        currentToken: rec.shareToken,
      });
      return { revoked: false, reason: 'stale', currentToken: rec.shareToken };
    }

    // dryRun 모드: 실제 변경 없이 결과만 미리 알려줌
    if (opts?.dryRun) {
      await this.audit('REVOKE_DRYRUN', rec.id, actor, { currentToken: rec.shareToken });
      return { revoked: true, reason: 'revoked', currentToken: rec.shareToken };
    }

    // ✅ 경쟁 안전한 회수:
    // expectedToken이 있으면 정확히 그 토큰일 때만 null로,
    // 없으면 "현재 null이 아닌 경우"만 null로.
    const where: any = { id: rec.id };
    where.shareToken = opts?.expectedToken ? opts.expectedToken : { not: null };

    const result = await prisma.receipt.updateMany({
      where,
      data: { shareToken: null },
    });

    if (result.count === 0) {
      // 동시성: 다른 요청이 먼저 회수/회전했을 수 있음 → 현재 상태 재확인
      const again = await prisma.receipt.findUnique({
        where: { id: rec.id },
        select: { shareToken: true },
      });

      if (!again?.shareToken) {
        // 이미 다른 요청이 회수 완료
        await this.audit('REVOKE_RACE_NOOP', rec.id, actor, { race: true });
        return { revoked: false, reason: 'noop', currentToken: null };
      }

      // expectedToken을 사용한 경우엔 'stale' 처리 유지
      if (opts?.expectedToken && again.shareToken !== opts.expectedToken) {
        await this.audit('REVOKE_STALE', rec.id, actor, {
          expectedToken: opts.expectedToken,
          currentToken: again.shareToken,
          race: true,
        });
        return { revoked: false, reason: 'stale', currentToken: again.shareToken };
      }

      // 그 외엔 현재 토큰이 여전히 살아있음(조건 불일치)
      await this.audit('REVOKE_NOOP', rec.id, actor, { reason: 'condition_not_met' });
      return { revoked: false, reason: 'noop', currentToken: again.shareToken ?? null };
    }

    // 성공적으로 회수됨
    await this.audit('REVOKE', rec.id, actor, {
      prevToken: rec.shareToken,
      expectedToken: opts?.expectedToken ?? null,
    });
    return { revoked: true, reason: 'revoked', currentToken: null };
  }

  /** 주소 기반 소유자 인가 */
  private assertOwnerByAddress(from: string, to: string, actorAddrs: string[]) {
    const set = new Set((actorAddrs || []).map((a) => a.toLowerCase()));
    const ok = set.has(from.toLowerCase()) || set.has(to.toLowerCase());
    if (!ok) throw new ForbiddenException('not a receipt owner');
  }

  /**
   * 감사 로그: DB에 ReceiptAudit 테이블이 있으면 거기에 기록,
   * 없으면 logger로 fallback (스키마 아직 없을 때도 안전)
   */
  private async audit(
    action: 'ISSUE' | 'REUSE' | 'ROTATE' | 'REVOKE' | 'REVOKE_NOOP' | 'REVOKE_STALE' | 'REVOKE_DRYRUN' | 'REVOKE_RACE_NOOP',
    receiptId: string,
    actor: Actor,
    meta?: Record<string, any>,
  ) {
    try {
      // 선택: ReceiptAudit 스키마가 있을 때만 성공
      await prisma.receiptAudit.create({
        data: {
          receiptId,
          actorUserId: actor.userId ?? null,
          action,
          ip: actor.ip ?? null,
          userAgent: actor.ua ?? null,
          meta: meta ? (meta as any) : undefined, // JSON 컬럼이 있으면
        },
      });
    } catch (e) {
      // 스키마가 없거나 실패해도 서비스는 계속 진행
      this.logger.log(
        `[AUDIT] ${action} receipt=${receiptId} actor=${actor.userId} meta=${JSON.stringify(meta ?? {})}`,
      );
    }
  }

  async listActivity(params: {
    address?: string;
    chainId?: number;
    direction?: 'SENT' | 'RECEIVED';
    cursor?: string;
    limit?: number;
    from?: string;
    to?: string;
  }) {
    const take = Math.min(params.limit ?? 20, 100);
    const where: any = {};
    if (params.address) where.OR = [{ fromAddress: params.address }, { toAddress: params.address }];
    if (params.chainId) where.chainId = params.chainId;
    if (params.direction) where.direction = params.direction;
    if (params.from || params.to) {
      where.confirmedAt = {};
      if (params.from) where.confirmedAt.gte = new Date(params.from);
      if (params.to) where.confirmedAt.lte = new Date(params.to);
    }

    const rows = await prisma.receipt.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: take + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }
}