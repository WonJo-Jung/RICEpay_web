"use client";
import { useState } from "react";
import { useWalletClient } from "wagmi";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
const DURATION = Number(process.env.VALID_SIGNITURE_DURATION_S!);

export default function ShareRevokeButton({
  id,
  currentToken, // 화면에 표시 중인 토큰(스테일 보호용)
  onRevoked, // 회수 성공 시 콜백(리스트 갱신 등)
}: {
  id: string;
  currentToken: string | null;
  onRevoked?: () => void;
}) {
  const { data: wallet } = useWalletClient();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signForRevoke(path: string, expectedToken?: string | null) {
    if (!wallet) throw new Error("지갑이 연결되어 있지 않습니다 (wagmi)");
    const [address] = await wallet.getAddresses();
    if (!address) throw new Error("지갑 주소를 가져올 수 없습니다");
    const exp = Math.floor(Date.now() / 1000) + DURATION;
    const message =
      `POST ${path}\n` +
      (expectedToken ? `token=${expectedToken}\n` : "") +
      `exp=${exp}`;
    const signature = await wallet.signMessage({ account: address, message });
    return { address: address.toLowerCase(), signature, exp };
  }

  async function revoke() {
    setLoading(true);
    setErr(null);
    try {
      const path = `/v1/receipts/${id}/share/revoke`;
      const { address, signature, exp } = await signForRevoke(
        path,
        currentToken ?? undefined
      );

      const res = await fetch(`${API_BASE}/receipts/${id}/share/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          signature,
          exp,
          expectedToken: currentToken ?? undefined, // 스테일 보호
        }),
      });
      if (!res.ok)
        throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
      const json: {
        revoked: boolean;
        reason: "revoked" | "noop" | "stale";
        currentToken: string | null;
      } = await res.json();

      if (json.revoked) {
        onRevoked?.();
      } else {
        // stale이면 최신 토큰을 UI에 반영해주는 게 UX 좋음
        if (json.reason === "stale" && json.currentToken) {
          setErr(
            "다른 곳에서 링크가 갱신되었습니다. 화면을 새로고침 후 다시 시도하세요."
          );
        } else if (json.reason === "noop") {
          setErr("이미 회수된 링크입니다.");
          onRevoked?.();
        } else {
          setErr("회수에 실패했습니다.");
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={revoke}
        className="rounded border px-3 py-2 text-xs disabled:opacity-60"
        disabled={loading || !currentToken}
        title="현재 공유 링크를 무효화합니다"
      >
        {loading ? "회수 중…" : "공유 링크 회수"}
      </button>
      {err && <span className="text-red-600 text-xs">{err}</span>}
    </div>
  );
}
