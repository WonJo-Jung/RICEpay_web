"use client";

import { shortAddr } from "../lib/address";
import { computeDirection } from "../lib/direction";
import { formatDateTime } from "../lib/datetime";
import type { Receipt } from "../hooks/useReceipt";
import ShareIssueRotateButton from "./ShareIssueRotateButton";
import Link from "next/link";

const EXPLORER_TX = process.env.NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER!;

export default function ReceiptView({
  receipt,
  myAddresses,
}: {
  receipt: Receipt;
  myAddresses?: string[];
}) {
  const dir = computeDirection(
    myAddresses ?? null,
    receipt.fromAddress,
    receipt.toAddress
  );

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-xl border p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          {dir === "SENT" ? "송금 영수증" : "수취 영수증"}
        </h1>
        <span
          className={`rounded-md px-2 py-1 text-xs ${dir === "SENT" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
        >
          {dir}
        </span>
      </header>

      <section className="grid grid-cols-2 gap-3 text-sm">
        <div className="font-medium">자산/금액</div>
        <div>
          {receipt.token} {receipt.amount}
        </div>

        <div className="font-medium">환산금액</div>
        <div>
          {receipt.fiatCurrency} {receipt.fiatAmount} (rate: {receipt.fiatRate})
        </div>

        {receipt.gasFiatAmount && (
          <>
            <div className="font-medium">가스비</div>
            <div>
              {receipt.gasFiatAmount} {receipt.fiatCurrency}
            </div>
          </>
        )}

        {receipt.appFeeFiat && (
          <>
            <div className="font-medium">앱 수수료</div>
            <div>
              {receipt.appFeeFiat} {receipt.fiatCurrency}
            </div>
          </>
        )}

        <div className="font-medium">보낸 주소</div>
        <div>{shortAddr(receipt.fromAddress)}</div>

        <div className="font-medium">받는 주소</div>
        <div>{shortAddr(receipt.toAddress)}</div>

        <div className="font-medium">네트워크</div>
        <div>
          {receipt.network} (chainId {receipt.chainId})
        </div>

        <div className="font-medium">제출/확정</div>
        <div>
          {formatDateTime(receipt.submittedAt)} →{" "}
          {formatDateTime(receipt.confirmedAt)}
        </div>

        <div className="font-medium">Tx</div>
        <div>
          <Link
            href={`${EXPLORER_TX}/${receipt.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            🔗 Explorer에서 보기
          </Link>
        </div>

        <div className="font-medium">정책</div>
        <div>{receipt.policyVersion}</div>
      </section>

      {myAddresses && <ShareIssueRotateButton id={receipt.id} />}
    </div>
  );
}
