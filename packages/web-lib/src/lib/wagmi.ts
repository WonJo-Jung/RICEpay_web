import { http, createConfig } from 'wagmi'
import { BASE_SEPOLIA } from '@ricepay/shared'  // 공통 정의 불러오기

export const config = createConfig({
  chains: [BASE_SEPOLIA],
  transports: { [BASE_SEPOLIA.id]: http(BASE_SEPOLIA.rpcUrls.default.http[0]) },
})
