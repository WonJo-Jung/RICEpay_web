"use client";

import { useEffect, useMemo, useState } from "react";
import { useAddressBook } from "../hooks/useAddressBook";
import type { AddressBookEntry, Chain } from "@ricepay/shared";
import { normalizeEvmAddress } from "@ricepay/shared";
import toast, { Toaster } from "react-hot-toast";
import { alchemyChains } from "../lib/viem";

type SortKey = "recent" | "name";

export default function AddressBookPanel() {
  // 리스트 훅 (필터 연동)
  const [query, setQuery] = useState("");
  const [filterChain, setFilterChain] = useState<Chain | undefined>(undefined);
  const {
    items,
    loading,
    error: listError,
    create,
    remove,
    markUsed,
    reload,
  } = useAddressBook({ query, chain: filterChain });

  // 폼 상태
  const [name, setName] = useState("");
  const [chain, setChain] = useState<Chain>(
    process.env.NEXT_PUBLIC_CHAIN_ENVIRONMENT === "PROD"
      ? "Base"
      : "Base Sepolia Testnet"
  );
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [sort, setSort] = useState<SortKey>("recent");
  // 정렬(단순 버전)
  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === "recent") {
      copy.sort(
        (a, b) =>
          (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") ||
          b.usageCount - a.usageCount ||
          a.name.localeCompare(b.name)
      );
    } else {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    }
    return copy;
  }, [items, sort]);

  // 삭제 UX: 되돌리기(10초)
  const [lastDeleted, setLastDeleted] = useState<AddressBookEntry | null>(null);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);

  async function handleDelete(id: string) {
    const ok = window.confirm(
      "이 수취인을 삭제할까요? (나중에 같은 주소로 저장하면 복구됩니다)"
    );
    if (!ok) return;
    const toDelete = items.find((i) => i.id === id);
    try {
      await remove(id);
      toast.success("삭제되었습니다");
      if (toDelete) {
        setLastDeleted(toDelete);
        if (undoTimer) clearTimeout(undoTimer);
        setUndoTimer(setTimeout(() => setLastDeleted(null), 10_000));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  async function handleUndo() {
    if (!lastDeleted) return;
    try {
      await create({
        name: lastDeleted.name,
        chain: lastDeleted.chain,
        address: lastDeleted.address,
        memo: lastDeleted.memo ?? "",
      });
      setLastDeleted(null);
      toast.success("되돌렸습니다");
    } catch (e: any) {
      toast.error(e?.message ?? "되돌리기 실패");
    }
  }

  useEffect(
    () => () => {
      if (undoTimer) clearTimeout(undoTimer);
    },
    [undoTimer]
  );

  async function onUse(id: string) {
    try {
      await markUsed(id);
      toast.success("사용 기록 업데이트");
    } catch (e: any) {
      toast.error(e?.message ?? "사용 처리 실패");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || done) return;

    setFormError(null);
    if (!name.trim()) return setFormError("이름을 입력하세요.");
    if (!address.trim()) return setFormError("지갑 주소를 입력하세요.");
    if (!consent) return setFormError("주소록 저장 동의에 체크하세요.");

    try {
      setSubmitting(true);
      const checksum = normalizeEvmAddress(address.trim());
      if (!checksum) {
        setFormError("유효하지 않은 EVM 주소입니다");
        toast.error("유효하지 않은 EVM 주소입니다");
        return;
      }
      await create({
        name: name.trim(),
        chain,
        address: checksum,
        memo: memo.trim(),
      });
      setDone(true);
      toast.success("저장되었습니다");

      // 폼 리셋
      setName("");
      setAddress("");
      setMemo("");
      setConsent(false);

      // 목록 갱신
      await reload();
    } catch (e: any) {
      const msg = e?.message ?? "저장 실패";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setTimeout(() => setDone(false), 1200); // 완료 배지 잠깐 표시
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Toaster position="top-center" />

      {/* 안내 배너 */}
      <div style={{ color: "#ff0000" }}>
        주소록은 <b>이 기기에만</b> 저장됩니다. 서버에 전송하지 않으며, 기기
        변경 시 복구되지 않습니다.
      </div>

      {/* ===== 폼 ===== */}
      <form onSubmit={onSubmit} style={styles.card}>
        <h3 style={styles.title}>주소록 저장</h3>

        <label style={styles.label}>
          <span>수취인 이름</span>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: Alice"
            maxLength={64}
          />
        </label>

        <label style={styles.label}>
          <span>체인</span>
          <select
            style={styles.input}
            value={chain}
            onChange={(e) => setChain(e.target.value as Chain)}
          >
            {Object.values(alchemyChains)
              .map((c) => c.label)
              .map((n) => (
                <option key={n} value={n}>
                  {n[0] + n.slice(1).toLowerCase()}
                </option>
              ))}
          </select>
        </label>

        <label style={styles.label}>
          <span>지갑 주소</span>
          <input
            style={styles.input}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x… (EVM 주소)"
          />
        </label>

        <label style={styles.label}>
          <span>메모 (선택)</span>
          <input
            style={styles.input}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 가족, 상점명 등"
            maxLength={2000}
          />
        </label>

        <label
          style={{
            ...styles.label,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            이 수취인을 <strong>이 기기</strong>에 저장하는 데 동의합니다
          </span>
        </label>

        {formError && <div style={styles.error}>{formError}</div>}
        <button
          type="submit"
          disabled={submitting}
          style={{ ...styles.button, opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? "저장 중…" : "저장"}
        </button>
        {done && <div style={styles.success}>저장되었습니다 ✅</div>}
      </form>

      {/* ===== 목록 툴바 ===== */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          style={{ ...styles.input, flex: 1 }}
          placeholder="이름/주소/메모 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          style={styles.input}
          value={filterChain ?? ""}
          onChange={(e) =>
            setFilterChain((e.target.value || undefined) as Chain | undefined)
          }
        >
          <option value="">전체 체인</option>
          {Object.values(alchemyChains)
            .map((c) => c.label)
            .map((n) => (
              <option key={n} value={n}>
                {n[0] + n.slice(1).toLowerCase()}
              </option>
            ))}
        </select>
        <select
          className="border rounded px-3 py-2"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          title="정렬"
        >
          <option value="recent">최근순</option>
          <option value="name">이름순</option>
        </select>
        <button onClick={() => reload()} style={styles.secondaryBtn}>
          새로고침
        </button>
      </div>

      {/* ===== 목록 ===== */}
      <div style={styles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h3 style={styles.title}>주소록 목록</h3>
          <span style={{ color: "#6b7280" }}>
            {loading ? "로딩 중…" : `${sorted.length}건`}
          </span>
        </div>

        {listError && <div style={styles.error}>불러오기 오류</div>}

        {!loading && sorted.length === 0 ? (
          <div style={{ color: "#6b7280" }}>저장된 주소가 없습니다.</div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 8,
            }}
          >
            {sorted.map((e) => (
              <li key={e.id} style={styles.row}>
                <div style={{ display: "grid", gap: 4 }}>
                  <b>{e.name}</b>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {e.chain} · {e.address} · {e.memo}
                  </span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    사용횟수 {e.usageCount}
                    {e.lastUsedAt
                      ? ` · 최근 ${new Date(e.lastUsedAt).toLocaleString()}`
                      : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    title="이 수취인을 사용한 것으로 기록(최근순 정렬에 반영)"
                    onClick={async () => await onUse(e.id)}
                    style={styles.pillBtn}
                  >
                    사용
                  </button>
                  <button
                    title="삭제해도 같은 주소로 다시 저장하면 복구됩니다"
                    onClick={async () => await handleDelete(e.id)}
                    style={{
                      ...styles.pillBtn,
                      background: "#fee2e2",
                      color: "#991b1b",
                    }}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 삭제 후 되돌리기 배너 */}
        {lastDeleted && (
          <div>
            삭제되었습니다.
            <button
              onClick={handleUndo}
              style={{
                ...styles.pillBtn,
                background: "#e5fee2",
                color: "#68bf5e",
              }}
            >
              되돌리기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    width: "100%",
    maxWidth: 760,
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  label: { display: "flex", flexDirection: "column", gap: 6 },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    outline: "none",
  },
  button: {
    height: 40,
    borderRadius: 8,
    background: "#111827",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryBtn: {
    height: 40,
    borderRadius: 8,
    background: "#e5e7eb",
    color: "#111827",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    padding: "0 12px",
  },
  error: { color: "crimson", fontSize: 13 },
  success: { color: "#065f46", fontSize: 13 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    alignItems: "center",
  },
  pillBtn: {
    height: 32,
    borderRadius: 999,
    padding: "0 12px",
    background: "#eef2ff",
    color: "#3730a3",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
};
