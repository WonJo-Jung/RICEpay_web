import { getAddress } from 'viem';

export function normalize(chain: string, address: string) {
  return {
    chain: chain.toUpperCase(),
    address: getAddress(address).toLowerCase(),
    checksum: getAddress(address),
  };
}