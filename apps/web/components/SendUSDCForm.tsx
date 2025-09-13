"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useUSDC } from "../hooks/useUSDC";

export default function SendUSDCForm() {
  const { address, isConnected } = useAccount();
  const [txState, setTxState] = useState<{
    status: "pending" | "success" | "failed";
    hash: `0x${string}`;
    blockNumber?: number;
    feeEth?: string;
    explorerUrl?: string;
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
        <button
          onClick={async () => await transfer(to, amt)}
          disabled={!isConnected}
        >
          Send
        </button>
      </div>

      {txState && txState.status === "success" && (
        <>
          <div>
            <span>status: {txState.status}, </span>
            <span>hash: {txState.hash}, </span>
            <span>blockNumber: {txState.blockNumber}, </span>
            <span>feeEth: {txState.feeEth}, </span>
            <a href={txState.explorerUrl} target="_blank" rel="noreferrer">
              Explorer에서 보기
            </a>
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
