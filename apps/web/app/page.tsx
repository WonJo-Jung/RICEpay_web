import { ConnectButton } from "@ricepay/web-lib";
import SendUSDCForm from "../components/SendUSDCForm";
import FxCard from "../components/FxCard";
import { fxTtlSeconds } from "../lib/config";
import { fetchUsdMxnServer } from "../lib/fx-server";

// 이 파일에서 수행하는 fetch의 기본 ISR 주기를 .env와 동기화
export const revalidate = fxTtlSeconds;

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
    </main>
  );
}
