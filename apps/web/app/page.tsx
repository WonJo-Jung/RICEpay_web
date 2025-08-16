import { ConnectButton } from "@ricepay/web-lib";
import SendUSDCForm from "../components/SendUSDCForm";

export default function Page() {
  return (
    <main>
      <h1>WalletConnect Test</h1>
      <ConnectButton />
      <SendUSDCForm />
    </main>
  );
}
