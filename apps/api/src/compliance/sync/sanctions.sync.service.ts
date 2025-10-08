import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '../../lib/db';
import axios from 'axios';
import { normalize } from '../utils/address';

@Injectable()
export class SanctionsSyncService {
  private readonly log = new Logger(SanctionsSyncService.name);

  @Cron(process.env.SANCTIONS_SYNC_CRON || CronExpression.EVERY_12_HOURS)
  async sync() {
    if ((process.env.SANCTIONS_PROVIDER ?? 'LOCAL') === 'LOCAL') return;

    // ✅ jitter
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 60_000)));

    const started = Date.now();
    const last = await prisma.syncState.findUnique({ where: { key: 'SANCTIONS/PROVIDER' } });
    const since = last?.version ?? null;

    let items: Array<{ chain: string; address: string; source: string; reason?: string; version?: string }> = [];
    let version: string | undefined;

    // ✅ ③ retry with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const headers: Record<string, string> = {};
        if (since) headers['If-Modified-Since'] = since;

        const res = await axios.get(
          `${process.env.COMPLY_ADVANTAGE_BASE_URL}/v1/sanctions/deltas`,
          {
            headers: {
              Authorization: `Token ${process.env.COMPLY_ADVANTAGE_API_KEY}`,
              ...headers,
            },
          },
        );

        if (res.status === 304) {
          this.log.log('No new sanctions data (Not Modified)');
          return;
        }

        items = res.data.items || [];
        version = res.data.version || new Date().toISOString();
        break;
      } catch (e: any) {
        if (attempt === 3) throw e;
        const delay = 1000 * 2 ** attempt;
        this.log.warn(`Sync failed (attempt ${attempt}), retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    if (!items.length) {
      const next = (last?.consecutiveNoop ?? 0) + 1;
      await prisma.syncState.upsert({
        where: { key: 'SANCTIONS/PROVIDER' },
        update: { consecutiveNoop: next },
        create: { key: 'SANCTIONS/PROVIDER', consecutiveNoop: next },
      });
      if (next >= 3) this.log.warn('⚠️ No sanctions updates for 3 consecutive syncs');
      return;
    }

    // ✅ upsert with checksum
    for (const it of items) {
      try {
        const { checksum } = normalize(it.chain, it.address); // checksum (throws if invalid)
        await prisma.sanctionedAddress.upsert({
          where: {
            chain_address: {
              chain: it.chain.toUpperCase(),
              address: it.address.toLowerCase(),
            },
          },
          update: {
            checksum,
            source: it.source,
            reason: it.reason,
            version: it.version ?? version,
          },
          create: {
            chain: it.chain.toUpperCase(),
            address: it.address.toLowerCase(),
            checksum,
            source: it.source,
            reason: it.reason,
            version: it.version ?? version,
          },
        });
      } catch (err) {
        // 주소 형식이 잘못된 경우 skip
        this.log.warn(`Invalid address skipped: ${it.address}`);
      }
    }

    await prisma.syncState.upsert({
      where: { key: 'SANCTIONS/PROVIDER' },
      update: { version, consecutiveNoop: 0 },
      create: { key: 'SANCTIONS/PROVIDER', version, consecutiveNoop: 0 },
    });

    this.log.log(
      `✅ Sanctions synced: ${items.length} items, version=${version}, took=${Date.now() - started}ms`,
    );
  }
}