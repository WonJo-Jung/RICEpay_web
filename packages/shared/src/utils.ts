import { HttpRequestError, isAddress, RpcRequestError, UserRejectedRequestError, WaitForTransactionReceiptTimeoutError } from "viem"

// 에러가 "재시도 가능"한지 판별
function isRetryable(err: unknown) {
  if (err instanceof UserRejectedRequestError) return false // ❌ 절대 재시도 금지
  if (err instanceof WaitForTransactionReceiptTimeoutError) return true
  if (err instanceof HttpRequestError) return true
  if (err instanceof RpcRequestError) return true

  const msg = (err as any)?.message || (err as any)?.shortMessage || ''
  // 네트워크성 문자열 핸들링(환경별)
  if (/timeout|timed out|network error|fetch failed|ECONNRESET/i.test(msg)) return true
  return false
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseMs = 400): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryable(err) || i === retries) break
      await new Promise(r => setTimeout(r, baseMs * Math.pow(2, i)))
    }
  }
  throw lastErr
}

export function assertAddress(addr: string): asserts addr is `0x${string}` {
  if (!isAddress(addr)) {
    const e = new Error("INVALID_ADDRESS")
    ;(e as any).ux = "잘못된 지갑 주소예요. 0x로 시작하는 올바른 주소를 입력해 주세요."
    throw e
  }
}

export function toUserMessage(err: unknown): string {
  if (err && typeof err === "object" && "ux" in (err as any)) {
    return (err as any).ux
  }
  const msg = (err as any)?.shortMessage || (err as any)?.message
  if (msg?.includes("User rejected")) return "서명을 취소했어요."
  if (msg?.includes("chainId")) return "Base Sepolia 네트워크로 전환해 주세요."
  if (msg?.includes("insufficient funds")) return "가스비가 부족해요."
  if (msg?.includes('"transfer" reverted')) return '토큰 잔액이 부족합니다.'
  return msg || "알 수 없는 오류가 발생했어요."
}