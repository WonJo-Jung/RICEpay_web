"use client";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useUSDC } from "../hooks/useUSDC";
import { useTxStatus } from "../hooks/useTxStatus";
import TxStatusBadge from "../components/TxStatusBadge";
import { ComplianceResult } from "../lib/tx";

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
  const [compliance, setCompliance] = useState<ComplianceResult>(null);

  const {
    record: txRecord,
    loading: txLoading,
    error: txError,
  } = useTxStatus(hash, {
    sse: true,
    pollMs: 5000,
    stopOnTerminal: true,
    minConfirmations: 1,
    // timeoutMs: 5 * 60 * 1000, // 5분 타임아웃
    minIntervalMs: 8000,

    onAnyUpdate: (rec) => {
      // 상태/컨펌 변화 최초 1회
      console.log("[Tx Update]", rec.status, rec.txHash, rec.confirmations);
    },
    onConfirmed: (rec) => {
      alert("송금 완료. 트랜잭션이 확정되었습니다.");
      console.log("[TX][confirmed]", rec.txHash, rec.confirmations);
      // 필요 시 탐색기 열기: window.open(`${EXPLORER_TX}/${rec.txHash}`, "_blank");
    },
    onFailed: (rec) => {
      alert(
        "송금 실패: 트랜잭션이 실패했습니다. 영수증에서 세부 사유를 확인하세요."
      );
      console.warn("[TX][failed]", rec.txHash);
    },
    onExpired: (rec) => {
      alert(
        "만료됨: 오랫동안 처리되지 않아 만료 처리되었습니다. 네트워크/가스 설정을 확인하고 재시도하세요."
      );
      console.warn("[TX][expired]", rec.txHash);
    },
    onDroppedReplaced: (rec) => {
      // 대체(프론트에 새 해시를 알 수 없으면 안내만)
      alert(
        "트랜잭션이 더 높은 가스 가격 등으로 대체되었습니다. 최신 해시로 다시 추적해 주세요."
      );
      console.warn("[TX][dropped_replaced]", rec.txHash);
    },
    onTerminal: (rec) => {
      console.log("[TX][terminal]", rec.txHash, rec.status);
    },
  });

  const onSend = async () => {
    try {
      setIsSending(true);
      const { hash: h, compliance: c } = await transfer(to, amt);
      setHash(h);
      setCompliance(c);
    } finally {
      setIsSending(false);
    }
  };

  const complianceBanner = useMemo(() => {
    if (!compliance) return null;

    if (compliance.kind === "success") {
      return <div>{compliance.msg} (201)</div>;
    }

    const { status, data } = compliance;
    const { type, reason } = data;

    if (status === 451 && type === "GEOFENCE") {
      return (
        <div>
          <div>{compliance.msg} (451)</div>
          <div>사유: {reason ?? "unavailable_for_legal_reasons"}</div>
        </div>
      );
    }
    if (status === 403 && type === "SANCTIONS" && "checksum" in data) {
      return (
        <div>
          <div>{compliance.msg} (403)</div>
          <div>사유: {reason ?? "sanctions_hit"}</div>
          {data.checksum && <div>주소 체크섬: {data.checksum}</div>}
        </div>
      );
    }
    if (
      status === 503 &&
      type === "SANCTIONS" &&
      reason === "provider_unavailable"
    ) {
      return (
        <div>
          <div>{compliance.msg} (503)</div>
        </div>
      );
    }
    return (
      <div>
        <div>요청 실패 (HTTP {status})</div>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  }, [compliance]);

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
            {txLoading && <span>전송 상태 로딩 중...</span>}
            {txError && (
              <span style={{ color: "red" }}>
                {(txError as Error)?.message ?? "상태 조회 중 오류"}
              </span>
            )}
            <TxStatusBadge tx={txRecord ?? null} />
          </div>
          {txState.transfer && (
            <div>
              <span>from: {txState.transfer.from}, </span>
              <span>to: {txState.transfer.to}, </span>
              <span>value: {txState.transfer.value.toString()}</span>
            </div>
          )}
        </>
      )}

      {txState && txState.status === "failed" && (
        <div>
          <span>msg: {txState.errMsg}</span>
        </div>
      )}

      {complianceBanner}
    </div>
  );
}
