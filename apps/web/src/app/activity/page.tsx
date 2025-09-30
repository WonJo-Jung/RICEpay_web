"use client";

import ActivityList from "../../components/ActivityList";
import { useAccount } from "wagmi"; // 이미 사용 중이면
// 없으면 myAddresses를 props로 주입하거나 로컬 스토리지에서 읽어도 됨

export default function ActivityPage() {
  const { address } = useAccount?.() ?? { address: undefined };
  const myAddresses = address ? [address] : undefined;

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">거래내역</h1>
      <ActivityList myAddresses={myAddresses} />
    </div>
  );
}
