import WalletProvider from "../lib/wallet";

export default function RootLayout({ children }) {
  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

  return (
    <html lang="en">
      <body>
        <WalletProvider projectId={projectId}>{children}</WalletProvider>
      </body>
    </html>
  );
}
