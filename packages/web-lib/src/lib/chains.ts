// packages/web/src/lib/chains.ts (웹)
import { http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

export const CHAINS = [mainnet, sepolia];
export const TRANSPORTS = {
  [mainnet.id]: http(),
  [sepolia.id]: http(),
};