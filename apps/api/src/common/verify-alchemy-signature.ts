import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyAlchemySignature(rawBody: string, headerSig: string, secret: string): boolean {
  if (!headerSig || !secret || !rawBody) return false;

  // Alchemy는 hex 서명 사용 → 모두 hex 버퍼로 비교
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  // 길이가 다르면 timingSafeEqual이 에러를 던짐 → 방어
  if (headerSig.length !== digest.length) return false;

  return timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(headerSig, 'hex'));
}