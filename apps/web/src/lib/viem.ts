import { BASE, BASE_SEPOLIA } from "@ricepay/shared"

const isAlchemyProdEnv = process.env.NEXT_PUBLIC_CHAIN_ENVIRONMENT === "PROD";

export const alchemyChains = isAlchemyProdEnv ? { [BASE.id]: BASE } : { [BASE_SEPOLIA.id]: BASE_SEPOLIA };