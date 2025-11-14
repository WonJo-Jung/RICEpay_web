"use client";

import { computeDirection } from "../lib/direction";
import { formatFullDateTime } from "../lib/datetime";
import type { Receipt } from "../hooks/useReceipt";
import ShareIssueRotateButton from "./ShareIssueRotateButton";
import Link from "next/link";
import { alchemyChains } from "../lib/viem";
import { Decimal } from "decimal.js";

const EXPLORER_TX = process.env.NEXT_PUBLIC_EXPLORER!;

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
      </header>

      <section className="grid grid-cols-2 gap-3 text-sm">
        <div className="font-medium">자산</div>
        <div>{receipt.token}</div>

        <div className="font-medium">금액</div>
        <div>{receipt.amount} USDC</div>

        {receipt.gasPaid && (
          <>
            <div className="font-medium">가스비</div>
            <div>{new Decimal(receipt.gasPaid).toFixed(30)} ETH</div>
          </>
        )}

        {receipt.appFee && (
          <>
            <div className="font-medium">앱 수수료</div>
            <div>{receipt.appFee} USDC</div>
          </>
        )}

        <div className="font-medium">보낸 주소</div>
        <div>{receipt.fromAddress}</div>

        <div className="font-medium">받는 주소</div>
        <div>{receipt.toAddress}</div>

        <div className="font-medium">체인</div>
        <div>
          {alchemyChains[receipt.chainId].label} (chainId {receipt.chainId})
        </div>

        <div className="font-medium">제출/확정</div>
        <div>
          {formatFullDateTime(receipt.submittedAt)} →{" "}
          {formatFullDateTime(receipt.confirmedAt)}
        </div>

        <div className="font-medium">트랜잭션</div>
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
