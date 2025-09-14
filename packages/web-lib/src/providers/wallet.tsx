"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { mainnet, sepolia } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { BASE_SEPOLIA } from "@ricepay/shared";

const queryClient = new QueryClient();

type NetworksTuple = Parameters<typeof createAppKit>[0]["networks"];
type AppKitNetwork = NetworksTuple extends readonly (infer U)[] ? U : never;

const BASE_SEPOLIA_APPKIT: AppKitNetwork = {
  id: BASE_SEPOLIA.id,
  name: BASE_SEPOLIA.name,
  nativeCurrency: BASE_SEPOLIA.nativeCurrency,
  rpcUrls: BASE_SEPOLIA.rpcUrls,
};

export default function WalletProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [wagmiConfig, setWagmiConfig] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 브라우저에서만 초기화 (SSR 차단)
    if (typeof window === "undefined") return;

    if (!projectId) {
      console.warn("⚠️ NEXT_PUBLIC_WC_PROJECT_ID is missing");
      return;
    }

    const networks = [
      mainnet,
      sepolia,
      BASE_SEPOLIA_APPKIT,
    ] as unknown as NetworksTuple;

    const adapter = new WagmiAdapter({
      networks,
      projectId,
      ssr: false, // SSR 꺼서 서버에서 Provider 로딩 방지
    });

    createAppKit({
      adapters: [adapter],
      networks,
      projectId,
      features: { analytics: false },
      defaultNetwork: BASE_SEPOLIA_APPKIT,
    });

    setWagmiConfig(adapter.wagmiConfig);
    setReady(true);
  }, [projectId]);

  if (!ready || !wagmiConfig) return null; // 초기화 전엔 렌더 생략(스켈레톤 넣어도 OK)

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
