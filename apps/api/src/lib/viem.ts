import { BASE, BASE_SEPOLIA } from "@ricepay/shared"

const isProdEnv = process.env.NODE_ENV === "production";

export const chains = isProdEnv ? { [BASE.id]: BASE, [BASE.name]: BASE } : { [BASE_SEPOLIA.id]: BASE_SEPOLIA, [BASE_SEPOLIA.name]: BASE_SEPOLIA };