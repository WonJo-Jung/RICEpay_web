"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { mainnet, sepolia } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

const queryClient = new QueryClient();

export default function WalletProvider({ children }: { children: ReactNode }) {
  const [wagmiConfig, setWagmiConfig] = useState<any>(null);
  const [ready, setReady] = useState(false);

  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

  useEffect(() => {
    // 브라우저에서만 초기화 (SSR 차단)
    if (typeof window === "undefined") return;

    if (!projectId) {
      console.warn("⚠️ NEXT_PUBLIC_WC_PROJECT_ID is missing");
      return;
    }

    // 1) 가변 배열 그대로 (타입 명시 X)
    // 🔧 createAppKit 옵션 타입에서 networks의 정확한 튜플 타입을 꺼내온 뒤 캐스팅
    type NetworksTuple = Parameters<typeof createAppKit>[0]["networks"];

    const networks = [mainnet, sepolia] as unknown as NetworksTuple;

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
