import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import * as ipaddr from 'ipaddr.js';

function ipInCidr(ip: string, cidr: string) {
  // cidr: "10.0.0.0/8" 형태
  try {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    const addr = ipaddr.parse(ip);
    const rangeAddr = ipaddr.parse(range);
    return addr.match(rangeAddr, bits);
  } catch {
    return false;
  }
}

function isIpAllowed(reqIp: string, allowlist: string): boolean {
  if (!allowlist) return true; // allowlist 비어있으면 IP 체크 생략
  const items = allowlist.split(',').map(s => s.trim()).filter(Boolean);
  for (const rule of items) {
    if (rule.includes('/')) {
      if (ipInCidr(reqIp, rule)) return true;
    } else {
      if (reqIp === rule) return true;
    }
  }
  return false;
}

@Injectable()
export class MaintenanceGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    // 비활성화면 막기
    if (process.env.MAINTENANCE_API_ENABLED !== 'true') {
      throw new ForbiddenException('Maintenance API disabled');
    }

    const req = ctx.switchToHttp().getRequest();
    const token = req.headers['x-admin-token'];
    const expected = process.env.MAINTENANCE_ADMIN_TOKEN;

    if (!expected || token !== expected) {
      throw new ForbiddenException('Invalid admin token');
    }

    // IP 체크 (선택)
    const allowlist = process.env.MAINTENANCE_IP_ALLOWLIST ?? '';
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0] ?? req.socket.remoteAddress ?? '').trim();
    if (!isIpAllowed(ip, allowlist)) {
      throw new ForbiddenException('IP not allowed');
    }

    return true;
  }
}