import type { HardhatUserConfig } from "hardhat/config";

import "dotenv/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

import { BASE_SEPOLIA } from "@ricepay/shared";

const { BASE_SEPOLIA_RPC_URL, PRIVATE_KEY } = process.env;

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
      url: BASE_SEPOLIA_RPC_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },
};

export default config;
