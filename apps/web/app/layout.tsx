import { WalletProvider } from "@ricepay/web-lib";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
