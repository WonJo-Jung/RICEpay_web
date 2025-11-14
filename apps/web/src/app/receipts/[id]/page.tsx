"use client";

import { useParams } from "next/navigation";
import { useReceiptById } from "../../../hooks/useReceipt";
import ReceiptView from "../../../components/ReceiptView";
import { useAccount } from "wagmi";

export default function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, loading, error } = useReceiptById(params?.id);
  const { address } = useAccount();

  if (loading)
    return <div className="p-4 text-sm text-gray-500">불러오는 중…</div>;
  if (error)
    return (
      <div className="p-4 text-sm text-red-600">에러: {String(error)}</div>
    );
  if (!data) return <div className="p-4 text-sm">영수증이 없습니다.</div>;

  return (
    <main className="p-4">
      <ReceiptView
        receipt={data}
        myAddresses={address ? [address] : undefined}
      />
    </main>
  );
}
