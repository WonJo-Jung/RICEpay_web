import { prisma } from '../../lib/db';
import { SanctionsProvider } from './sanctions.provider';

export class LocalSanctionsProvider implements SanctionsProvider {
  async checkAddress(chain: string, address: string) {
    const hit = await prisma.sanctionedAddress.findUnique({
      where: { chain_address: { chain, address } },
      select: { reason: true, source: true, version: true },
    });

    return hit
      ? { blocked: true, reason: hit.reason ?? hit.source ?? 'local', version: hit.version ?? undefined }
      : { blocked: false };
  }
}