"use client";
import { useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import ShareRevokeButton from "./ShareRevokeButton";
import { getNonce } from "../lib/address";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
const PREFIX = process.env.NEXT_PUBLIC_GLOBAL_PREFIX!;

export default function ShareIssueRotateButton({ id }: { id: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<"init" | "issue" | "rotate" | null>(
    null
  );
  const [err, setErr] = useState<string | null>(null);
  const { data: wallet } = useWalletClient();
  const [originHost, setOriginHost] = useState<string | null>(null);
  const { chainId } = useAccount();

  // 브라우저에서만 origin 설정
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOriginHost(window.location.origin);
    }
  }, []);

  // 🚀 마운트 시 현재 shareToken 불러오기
  useEffect(() => {
    (async () => {
      setLoading("init");
      try {
        const res = await fetch(`${API_BASE}/${PREFIX}/receipts/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.shareToken) {
            setToken(data.shareToken);
          }
        }
      } catch (e) {
        console.error("초기 토큰 조회 실패:", e);
      } finally {
        setLoading(null);
      }
    })();
  }, [id]);

  async function signForShareWithWagmi(path: string) {
    if (!wallet)
      throw new Error(
        "지갑이 연결되어 있지 않습니다 (wagmi walletClient 없음)"
      );
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
      `origin=${origin}`,
      `chainId=${chainId}`,
      `nonce=${nonce}`,
      `exp=${exp}`,
    ].join("\n");

    const signature = await wallet.signMessage({ account: address, message });
    return { address: address.toLowerCase(), signature, exp, nonce };
  }

  async function requestToken(force = false) {
    setLoading(force ? "rotate" : "issue");
    setErr(null);
    try {
      const path = `/${PREFIX}/receipts/${id}/share`;
      const { address, signature, exp, nonce } =
        await signForShareWithWagmi(path);

      const url = new URL(`${API_BASE}/${PREFIX}/receipts/${id}/share`);
      if (force) url.searchParams.set("force", "1");

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          signature,
          exp,
          nonce,
          origin,
          chainId,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${text}`);
      }
      const { token } = await res.json();
      setToken(token);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(null);
    }
  }

  const shareUrl = token
    ? `${process.env.NEXT_PUBLIC_WEB_SIGN_ORIGIN ?? "http://localhost:3000"}/external/${token}`
    : null;

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // noop
    }
  }

  return (
    <div className="mt-3 text-sm space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => requestToken(false)}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
          disabled={!!loading}
          title="이미 토큰이 있으면 그대로 반환, 없으면 새로 발급"
        >
          {loading === "issue" ? "요청 중…" : "공유 링크 만들기/가져오기"}
        </button>

        <button
          onClick={() => requestToken(true)}
          className="rounded border px-3 py-2 disabled:opacity-60"
          disabled={!!loading || !token}
          title="항상 새 토큰으로 교체(기존 링크 무효)"
        >
          {loading === "rotate" ? "회전 중…" : "새 링크로 교체"}
        </button>
      </div>

      {err && <div className="text-red-600">에러: {err}</div>}

      {shareUrl && (
        <div className="flex items-center gap-3">
          <span className="truncate max-w-[320px]">
            공유 URL:{" "}
            <a
              className="rounded px-2 py-1 border text-xs"
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              새 탭에서 열기
            </a>
          </span>
          <button onClick={copy} className="rounded px-2 py-1 border text-xs">
            복사
          </button>
          <ShareRevokeButton
            id={id}
            currentToken={token}
            onRevoked={() => {
              // 회수되면 로컬 상태 초기화
              setToken(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
