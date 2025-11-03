import { chains } from "../../lib/viem";

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const allow = (process.env.SIGN_ALLOWED_ORIGINS ?? "")
    .split(',').map(s => s.trim());
  return allow.includes(origin);
}

export function isAllowedChainId(id: number | undefined): boolean {
  if (!id) return false;
  const allow = (`${chains[id].id}`)
    .split(',').map(s => Number(s.trim()));
  return allow.includes(id);
}