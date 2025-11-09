import type { HardhatUserConfig } from "hardhat/config";

import "dotenv/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

import { BASE_SEPOLIA, BASE } from "@ricepay/shared";

const { DEPLOYER_PK, BASE_SEPOLIA_RPC_URL, BASE_RPC_URL } = process.env;

const config: HardhatUserConfig = {
  plugins: [hardhatEthers],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    baseSepolia: {
      type: "http",
      chainId: BASE_SEPOLIA.id,
      url: BASE_SEPOLIA_RPC_URL!,
      accounts: [DEPLOYER_PK!]
    },
    base: {
      type: "http",
      chainId: BASE.id,
      url: BASE_RPC_URL!,
      accounts: [DEPLOYER_PK!]
    }
  },
};

export default config;
