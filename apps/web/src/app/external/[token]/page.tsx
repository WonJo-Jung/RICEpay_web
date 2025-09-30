"use client";

import { useParams } from "next/navigation";
import { useReceiptByShareToken } from "../../../hooks/useReceipt";
import ReceiptView from "../../../components/ReceiptView";

export default function ReceiptSharePage() {
  const params = useParams<{ token: string }>();
  const { data, loading, error } = useReceiptByShareToken(params?.token);

  if (loading)
    return <div className="p-4 text-sm text-gray-500">불러오는 중…</div>;
  if (error)
    return (
      <div className="p-4 text-sm text-red-600">에러: {String(error)}</div>
    );
  if (!data) return <div className="p-4 text-sm">영수증이 없습니다.</div>;

  // 공유 링크는 내 주소 컨텍스트가 없으므로, ReceiptView 내부 로직이 기본 SENT로 표시
  return (
    <main className="p-4">
      <ReceiptView receipt={data} />
    </main>
  );
}
