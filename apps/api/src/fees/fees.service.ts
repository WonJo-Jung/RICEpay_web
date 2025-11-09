import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { PreviewDto } from './preview.dto';
import { calcFeeUsd, readPolicy, tokenIntToUsd, usdToTokenIntCeil } from './fee-policy.util';
import { chains } from '../lib/viem';

const USDC_ABI = [
  { "type":"function","name":"transfer","stateMutability":"nonpayable",
    "inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],
    "outputs":[{"type":"bool"}] }
];
// Base 체인 가정
const NATIVE_SYMBOL = 'ETH';
const NETWORK_NAME = 'Base';
const DECIMALS = 6;

@Injectable()
export class FeesService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  private policy = readPolicy();

  private async quotes() {
    return {
      usdcUsd: Number(process.env.FIXED_USDC_USD ?? 1.0),
      nativeUsd: Number(process.env.FIXED_ETH_USD ?? 2580),
      source: 'fixed',
    };
  }

  async fee(amountInt: bigint): Promise<number> {
    const { usdcUsd } = await this.quotes();
    const sendUsd = tokenIntToUsd(amountInt, usdcUsd, DECIMALS);
    return calcFeeUsd(sendUsd, this.policy);
  }

  // ✅ 짧은 재시도 + 타임아웃 래퍼
  private async withRetry<T>(fn: () => Promise<T>, tries = 2, timeoutMs = Number(process.env.RPC_TIMEOUT_MS ?? 2500)): Promise<T> {
    let last: any;
    for (let i = 0; i <= tries; i++) {
      try {
        return await Promise.race([
          fn(),
          new Promise<T>((_, rej) => setTimeout(() => rej(new Error('RPC_TIMEOUT')), timeoutMs)),
        ]);
      } catch (e) {
        last = e;
        await new Promise(r => setTimeout(r, 150 * (i + 1)));
      }
    }
    throw last;
  }

  // ✅ gas caps 5s 캐시
  private async gasCaps(client: any, chainKey: string) {
    const ck = `fees:gascaps:${chainKey}`;
    const cached = await this.cache.get<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>(ck);
    if (cached) return cached;

    const fh = await this.withRetry(() => client.request({ method: 'eth_feeHistory', params: [1, 'latest', []] }));
    const baseFee = BigInt((fh as any).baseFeePerGas?.[0] ?? '0x0');
    let tip = 1_500_000_000n; // 1.5 gwei
    try {
      const r = await this.withRetry(() => client.request({ method: 'eth_maxPriorityFeePerGas', params: [] }));
      if (r) tip = BigInt(r as string);
    } catch { /* keep default tip */ }

    const caps = { maxFeePerGas: baseFee * 2n + tip, maxPriorityFeePerGas: tip };
    await this.cache.set(ck, caps, 5); // 5s
    return caps;
  }

  async preview(q: PreviewDto) {
    const key = `fees:${q.chainId}:${q.from}:${q.to}:${q.token}:${q.amount}`;
    const hit = await this.cache.get<any>(key);
    if (hit) return hit; // ✅ 15s 캐시 히트 시 즉시 반환

    const chainId = Number(q.chainId);
    const chain = chains[chainId];
    const client = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });

    const amountInt = BigInt(q.amount);

    const data = encodeFunctionData({
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [q.to as `0x${string}`, amountInt],
    });

    let gasLimit: bigint;
    try {
      gasLimit = await this.withRetry(() =>
        client.estimateGas({ account: q.from as `0x${string}`, to: q.token as `0x${string}`, data }),
      );
    } catch {
      gasLimit = 80_000n;
    }

    const chainKey = String(chainId);
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.gasCaps(client, chainKey);
    const gasNativeWei = gasLimit * maxFeePerGas;

    const { usdcUsd, nativeUsd, source } = await this.quotes();

    const gasUsd = (Number(gasNativeWei) / 1e18) * nativeUsd;

    const feeUsd = await this.fee(amountInt);
    const feeInt = usdToTokenIntCeil(feeUsd, usdcUsd, DECIMALS);

    const receiver = amountInt - feeInt;

    const response = {
      // 📌 요청 체인 정보
      chainId: q.chainId,       // 사용자가 요청한 체인 ID
      token: q.token,           // 송금할 토큰 주소 (예: USDC 컨트랙트 주소)
      decimals: DECIMALS,                 // 토큰 소수점 자리수 (USDC=6)
      amount: q.amount,         // 송금자가 입력한 총 송금 금액 (토큰 정수 단위)

      // 📌 RICE Pay 수수료 (송금 금액에서 차감)
      riceFee: {
        usd: feeUsd.toFixed(2),    // 수수료 금액 (USD 환산, 소수점 2자리)
        token: feeInt.toString(),  // 수수료 금액 (토큰 정수 단위, USDC 소수점 적용 전)
        policy: this.policy,       // 수수료 정책 객체 (pct %, minUsd, maxUsd)
      },

      // 📌 네트워크 가스비 추정
      gas: {
        limit: gasLimit.toString(),               // 추정된 가스 한도 (gas units)
        maxFeePerGas: maxFeePerGas.toString(),   // EIP-1559 maxFeePerGas (wei)
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(), // EIP-1559 priority fee (tip) (wei)
        native: (Number(gasNativeWei) / 1e18).toFixed(8), // 가스비 (ETH 단위)
        nativeSymbol: NATIVE_SYMBOL,
        usd: gasUsd.toFixed(2),                   // 가스비 (USD 환산)
        bufferedUsd: (gasUsd * 1.1).toFixed(2),   // 안전 버퍼 포함 가스비 (USD, +10%)
      },

      // 📌 최종 결제 금액 요약
      totals: {
        payerPays: { 
          token: amountInt.toString(),        // 송금자가 보내려는 총 금액 (토큰 정수 단위)
          gasNative: gasNativeWei.toString(), // 송금자가 지불할 네트워크 가스비 (wei)
        },
        receiverGets: { 
          token: receiver.toString(),         // 실제 수취인이 받는 토큰 (총액 - 수수료)
        },
      },

      // 📌 환율 및 시세 정보
      quotes: {
        nativeUsd: nativeUsd.toFixed(2),   // 네이티브 토큰(ETH) → USD 환율
        usdcUsd: usdcUsd.toFixed(2),       // USDC → USD 환율 (보통 1.0)
        at: new Date().toISOString(),      // 견적 시각 (ISO 8601)
        source,                            // 환율 출처 (예: "fixed" 또는 API)
      },

      // 📌 메타데이터
      meta: { 
        confidence: 'medium',        // 견적 신뢰도 (추후 'high/low' 등으로 확장 가능)
        reestimateHint: true,        // 실제 송금 직전 재추정 필요 여부 힌트
        networkName: NETWORK_NAME,
      },
    };

    await this.cache.set(key, response, 15); // ✅ 15s TTL
    return response;
  }

  currentPolicyVersion() { return process.env.POLICY_VERSION!; }
}