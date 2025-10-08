import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { SanctionsService } from './sanctions.service';
import { prisma } from '../lib/db';

@Injectable()
export class ComplianceGuard implements CanActivate {
  constructor(
    private readonly geo: GeofenceService,
    private readonly sanc: SanctionsService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (process.env.COMPLIANCE_ENABLED !== 'true') return true;

    const req = ctx.switchToHttp().getRequest();
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').trim();

    if (process.env.GEOFENCE_ENABLED === 'true') {
      const g = await this.geo.check(req.headers, ip);
      if (g.blocked) {
        await prisma.complianceAudit.create({
          data: {
            type: 'GEOFENCE',
            status: 'BLOCKED',
            rule: g.level === 'COUNTRY' ? `COUNTRY:${g.country}` : `REGION:${g.region}`,
            country: g.country || undefined,
            region: g.region || undefined,
            ip, route: req.path,
          },
        });
        throw new HttpException({
          ok: false,
          type: 'GEOFENCE',
          level: g.level,
          country: g.country,
          region: g.region,
          reason: g.reason,
        }, 451);
      }
    }

    const body = req.body || {};
    const to = body.to ?? body.recipient ?? body.address;
    const chain = body.chain ?? body.chainId ?? body.network;
    if (process.env.SANCTIONS_ENABLED === 'true' && to && chain) {
      try {
        const s = await this.sanc.isBlocked(String(chain).toUpperCase(), String(to).toLowerCase());

        if (s.blocked) {
          await prisma.complianceAudit.create({
            data: {
              type: 'SANCTIONS',
              status: 'BLOCKED',
              // ✅ 체인/체크섬 주소를 rule에 남겨 감사 추적성 강화
              rule: `ADDR:${String(chain).toUpperCase()}/${s.checksum ?? String(to)}`,
              chain: String(chain).toUpperCase(),
              address: String(to).toLowerCase(),
              ip, route: req.path,
              version: s.version,
              // ✅ checksum은 meta에도 보관 (스키마에 checksum 컬럼이 없으므로)
              meta: { checksum: s.checksum, reason: s.reason },
            },
          });
          // 제재 주소 매칭: 접근 금지(403)
          throw new HttpException(
            {
              ok: false,
              type: 'SANCTIONS',
              reason: s.reason,
              checksum: s.checksum,
            },
            HttpStatus.FORBIDDEN, // 403
          );
        } else {
          await prisma.complianceAudit.create({
            data: {
              type: 'SANCTIONS',
              status: 'ALLOWED',
              chain: String(chain).toUpperCase(),
              address: String(to).toLowerCase(),
              ip, route: req.path,
              version: s.version,
              // ✅ 허용 케이스에서도 checksum을 로그에 남겨 일관성 확보
              meta: { checksum: s.checksum },
            },
          });
        }
      } catch (e) {
        if (e.status === HttpStatus.FORBIDDEN) throw e;
        // 운영에서 보수적으로 막고 싶다면 503으로 명확히 반환
        throw new HttpException(
          { ok: false, type: 'SANCTIONS', error: 'provider_unavailable' },
          HttpStatus.SERVICE_UNAVAILABLE, // 503
        );
      }
    }

    return true;
  }
}