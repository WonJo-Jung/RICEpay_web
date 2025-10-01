import { Controller, Post, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';

const DURATION = Number(process.env.VALID_SIGNITURE_DURATION_S!);

@Controller('auth')
export class AuthController {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  @Post('nonce')
  async issueNonce() {
    const nonce = randomUUID().replace(/-/g, '');
    const ttlSec = DURATION; // 2분 유효
    await this.cache.set(`nonce:${nonce}`, '1', ttlSec * 1000); // 값은 아무거나, TTL만 중요
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    return { nonce, exp };
  }
}