"use client";

import { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { alchemyChains } from "./viem";

const queryClient = new QueryClient();

type NetworksTuple = Parameters<typeof createAppKit>[0]["networks"];

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

    const networks = Object.values(alchemyChains) as unknown as NetworksTuple;

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
