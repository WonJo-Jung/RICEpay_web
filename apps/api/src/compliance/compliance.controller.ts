import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { SanctionsService } from './sanctions.service';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly geo: GeofenceService, private readonly sanc: SanctionsService) {}

  @Post('preflight')
  @HttpCode(200)
  async preflight(@Body() dto: { chain?: string; to?: string }, @Req() req: any) {
    if (process.env.COMPLIANCE_ENABLED !== 'true') return { ok: true };

    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').trim();

    if (process.env.GEOFENCE_ENABLED === 'true') {
      const g = await this.geo.check(req.headers, ip);
      if (g.blocked) return { ok: false, type: 'GEOFENCE', country: g.country, region: g.region, reason: g.reason };
    }

    if (process.env.SANCTIONS_ENABLED === 'true' && dto?.chain && dto?.to) {
      try {
        const s = await this.sanc.isBlocked(dto.chain, dto.to);
  
        if (s.blocked) {
          return {
            ok: false,
            type: 'SANCTIONS',
            reason: s.reason,
            checksum: s.checksum, // ✅ 프론트에서 신뢰성 있는 주소 표시용
          };
        }
        // 허용인 경우에도 checksum을 내려주면 프론트 표시/검증에 유용함 ✅
        return { ok: true, checksum: s.checksum };
      } catch {
        // 운영에서 보수적으로 막고 싶다면 503으로 명확히 반환
        return { ok: false, type: 'SANCTIONS', reason: 'provider_unavailable' };
      }
    }

    return { ok: true };
  }
}