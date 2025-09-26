"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useUSDC } from "../hooks/useUSDC";
import { useTxStatus } from "../hooks/useTxStatus";
import TxStatusBadge from "../components/TxStatusBadge";

export default function SendUSDCForm() {
  const { address, isConnected } = useAccount();
  const [txState, setTxState] = useState<{
    status: "pending" | "success" | "failed";
    hash: `0x${string}`;
    blockNumber?: number;
    feeEth?: string;
    transfer?: {
      from: `0x${string}`;
      to: `0x${string}`;
      value: bigint;
    };
    errMsg?: string;
  }>();
  const { getBalance, transfer } = useUSDC({ setTxState });
  const [to, setTo] = useState("" as `0x${string}`);
  const [amt, setAmt] = useState("0");
  const [isSending, setIsSending] = useState(false);
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const { record: txRecord } = useTxStatus(hash, {
    sse: true,
    pollMs: 5000,
  });

  const onSend = async () => {
    try {
      setIsSending(true);
      const h = await transfer(to, amt);
      setHash(h);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <div>My address: {address}</div>
      <button
        onClick={async () => alert(await getBalance())}
        disabled={!isConnected || txState?.status === "pending"}
      >
        Check USDC Balance
      </button>

      <div>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value as any)}
          placeholder="To (0x…)"
        />
        <input
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          placeholder="Amount (USDC)"
        />
        <button onClick={onSend} disabled={!isConnected || isSending}>
          Send
        </button>
        {isSending && <span>전송 중...</span>}
      </div>

      {txState && txState.status === "success" && (
        <>
          <div>
            <span>status: {txState.status}, </span>
            <span>hash: {txState.hash}, </span>
            <span>blockNumber: {txState.blockNumber}, </span>
            <span>feeEth: {txState.feeEth}</span>
            <TxStatusBadge tx={txRecord ?? null} />
          </div>
          {txState.transfer && (
            <div>
              <span>from: {txState.transfer.from}, </span>
              <span>to: {txState.transfer.to}, </span>
              <span>value: {txState.transfer.value}</span>
            </div>
          )}
        </>
      )}

      {txState && txState.status === "failed" && (
        <div>
          <span>msg: {txState.errMsg}</span>
        </div>
      )}
    </div>
  );
}
