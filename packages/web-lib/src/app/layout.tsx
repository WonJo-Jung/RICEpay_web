import "./globals.css";
import type { ReactNode } from "react";
import WalletProvider from "../providers/wallet";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
