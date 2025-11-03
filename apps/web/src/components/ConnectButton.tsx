"use client";

import { useEffect, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";

export default function ConnectButton() {
  const { open } = useAppKit(); // status 없음! open/close만 옴
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []); // CSR 보장용

  if (!mounted) return null;

  if (!isConnected) {
    return (
      <button
        onClick={() => open?.({ view: "Connect" })}
        style={{ padding: 8 }}
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div>Connected: {address}</div>
      <button
        onClick={() => open?.({ view: "Account" })}
        style={{ padding: 8 }}
      >
        Wallet Modal
      </button>
    </div>
  );
}
