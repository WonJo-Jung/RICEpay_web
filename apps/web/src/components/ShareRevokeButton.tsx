"use client";
import { useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { getNonce } from "../lib/address";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
const PREFIX = process.env.NEXT_PUBLIC_GLOBAL_PREFIX!;

export default function ShareRevokeButton({
  id,
  currentToken, // 화면에 표시 중인 토큰(스테일 보호용)
  onRevoked, // 회수 성공 시 콜백(리스트 갱신 등)
}: {
  id: string;
  currentToken: string | null;
  onRevoked?: () => void;
}) {
  const { chainId } = useAccount();
  const { data: wallet } = useWalletClient();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [originHost, setOriginHost] = useState<string | null>(null);

  // 브라우저에서만 origin 설정
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOriginHost(window.location.origin);
    }
  }, []);

  async function signForRevokeWithWagmi(
    path: string,
    expectedToken?: string | null
  ) {
    if (!wallet) throw new Error("지갑이 연결되어 있지 않습니다 (wagmi)");
    const [address] = await wallet.getAddresses();
    if (!address) throw new Error("지갑 주소를 가져올 수 없습니다");

    const { nonce, exp } = await getNonce();

    // 안전하게 origin 결정 (브라우저 or 환경변수)
    const origin =
      originHost ??
      (typeof window !== "undefined" ? window.location.origin : undefined) ??
      process.env.NEXT_PUBLIC_WEB_SIGN_ORIGIN ?? // 선택: .env에 정의해두면 SSR에서도 fallback
      "http://localhost:3000";

    const message = [
      `POST ${path}`,
      expectedToken ? `token=${expectedToken}` : null,
      `origin=${origin}`,
      `chainId=${chainId}`,
      `nonce=${nonce}`,
      `exp=${exp}`,
    ]
      .filter(Boolean)
      .join("\n");

    const signature = await wallet.signMessage({ account: address, message });
    return { address: address.toLowerCase(), signature, exp, nonce };
  }

  async function revoke() {
    setLoading(true);
    setErr(null);
    try {
      const path = `/${PREFIX}/receipts/${id}/share/revoke`;
      const { address, signature, exp, nonce } = await signForRevokeWithWagmi(
        path,
        currentToken ?? undefined
      );

      const res = await fetch(
        `${API_BASE}/${PREFIX}/receipts/${id}/share/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            signature,
            exp,
            nonce,
            origin,
            chainId,
            expectedToken: currentToken ?? undefined, // 스테일 보호
          }),
        }
      );
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
