import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { normalize } from './utils/address';
import { SanctionsProvider } from './providers/sanctions.provider';
import { prisma } from '../lib/db';

@Injectable()
export class SanctionsService {
  constructor(@Inject('SANCTIONS_PROVIDER') private provider: SanctionsProvider) {}

  async isBlocked(chain: string, address: string) {
    const { chain: c, address: a, checksum } = normalize(chain, address);

    // 1️⃣ 로컬 DB 조회 (즉시 차단)
    const local = await prisma.sanctionedAddress.findUnique({
      where: { chain_address: { chain: c, address: a } },
      select: { reason: true, source: true, version: true },
    });
    if (local)
      return {
        blocked: true,
        reason: local.reason ?? local.source ?? 'local',
        version: local.version,
        checksum, // ✅ 반환값에 포함
      };

    // 2️⃣ 외부 제재 API 조회 (실패는 여기서 정책 적용)
    try {
      const external = await this.provider.checkAddress(c, a);

      return { ...external, checksum };
    } catch (e) {
      const failOpen = process.env.SANCTIONS_FAIL_OPEN === 'true';
      await prisma.complianceAudit.create({
        data: { type:'SANCTIONS', status: failOpen ? 'ALLOWED' : 'ERROR',
                rule:'PROVIDER_ERROR', chain:c, address:a, meta:{ error:String(e) } },
      });
      if (failOpen) return { blocked:false as const, reason:'provider_error', checksum };
      // Guard가 503으로 매핑하도록 예외 던지기
      throw e;
    }
  }
}