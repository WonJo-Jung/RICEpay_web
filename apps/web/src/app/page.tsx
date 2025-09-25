import { ConnectButton } from "@ricepay/web-lib";
import SendUSDCForm from "../components/SendUSDCForm";
import FxCard from "../components/FxCard";
import { fetchUsdMxnServer } from "../lib/fx-server";
import SendPage from "./SendPage";
import AddressBookPage from "./AddressBookPage";

export default async function Page() {
  const data = await fetchUsdMxnServer(); // 초기 데이터

  return (
    <main>
      <h1>WalletConnect Test</h1>
      <ConnectButton />
      <div>******</div>
      <div>dev-04</div>
      <div>******</div>
      <SendUSDCForm />
      <div>******</div>
      <div>dev-05</div>
      <div>******</div>
      <FxCard initialData={data} />
      <div>******</div>
      <div>dev-06</div>
      <div>******</div>
      <SendPage />
      <div>******</div>
      <div>dev-07</div>
      <div>******</div>
      <AddressBookPage />
    </main>
  );
}
