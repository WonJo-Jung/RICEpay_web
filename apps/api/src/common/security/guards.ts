import { BASE_SEPOLIA } from "@ricepay/shared";

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const allow = (process.env.SIGN_ALLOWED_ORIGINS ?? "")
    .split(',').map(s => s.trim());
  return allow.includes(origin);
}

export function isAllowedChainId(id: number | undefined): boolean {
  if (!id) return false;
  const allow = (`${BASE_SEPOLIA.id}` || '84532')
    .split(',').map(s => Number(s.trim()));
  return allow.includes(id);
}