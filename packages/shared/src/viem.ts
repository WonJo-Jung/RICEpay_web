
import { defineChain } from 'viem';

// Base mainnet + Base Sepolia IDs (per viem)
export const BASE = {
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } }
};

export const BASE_SEPOLIA = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
  blockExplorers: {
    default: { name: 'Base Sepolia', url: 'https://sepolia-explorer.base.org' },
  },
  testnet: true,
};

export const USDC_DECIMALS = 6;

// Replace with actual addresses
export const USDC_BASE_ADDRESS = '0x0000000000000000000000000000000000000000';
export const USDC_BASE_SEPOLIA_ADDRESS = '0x0000000000000000000000000000000000000000';
