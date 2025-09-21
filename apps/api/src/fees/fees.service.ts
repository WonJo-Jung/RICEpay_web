import { Injectable } from '@nestjs/common';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { PreviewDto } from './preview.dto';
import { calcFeeUsd, readPolicy, tokenIntToUsd, usdToTokenIntCeil } from './fee-policy.util';

const USDC_ABI = [
  { "type":"function","name":"transfer","stateMutability":"nonpayable",
    "inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],
    "outputs":[{"type":"bool"}] }
];

const CHAIN = (id: number) => id === base.id ? base : baseSepolia;
const RPC   = (id: number) =>
  id === base.id ? process.env.CHAIN_BASE_MAINNET_RPC! : process.env.CHAIN_BASE_SEPOLIA_RPC!;

async function gasCaps(client: any) {
  const fh = await client.request({ method: 'eth_feeHistory', params: [1, 'latest', []] });
  const baseFee = BigInt(fh.baseFeePerGas?.[0] ?? '0x0');
  let tip = 1_500_000_000n; // 1.5 gwei
  try {
    const r = await client.request({ method: 'eth_maxPriorityFeePerGas', params: [] });
    if (r) tip = BigInt(r);
  } catch {}
  return { maxFeePerGas: baseFee * 2n + tip, maxPriorityFeePerGas: tip };
}

@Injectable()
export class FeesService {
  private policy = readPolicy();

  private async quotes() {
    return {
      usdcUsd: Number(process.env.FIXED_USDC_USD ?? 1.0),
      nativeUsd: Number(process.env.FIXED_ETH_USD ?? 2580),
      source: 'fixed'
    };
  }

  async preview(q: PreviewDto) {
    const chain = CHAIN(q.chainId);
    const client = createPublicClient({ chain, transport: http(RPC(q.chainId)) });

    const decimals = 6;
    const amountInt = BigInt(q.amount);

    const data = encodeFunctionData({
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [q.to as `0x${string}`, amountInt]
    });

    let gasLimit: bigint;
    try {
      gasLimit = await client.estimateGas({
        account: q.from as `0x${string}`,
        to: q.token as `0x${string}`,
        data
      });
    } catch {
      gasLimit = 80_000n;
    }

    const { maxFeePerGas, maxPriorityFeePerGas } = await gasCaps(client);
    const gasNative = gasLimit * maxFeePerGas;

    const { usdcUsd, nativeUsd, source } = await this.quotes();

    const sendUsd = tokenIntToUsd(amountInt, usdcUsd, decimals);
    const gasUsd  = Number(gasNative) / 1e18 * nativeUsd;

    const feeUsd  = calcFeeUsd(sendUsd, this.policy);
    const feeInt  = usdToTokenIntCeil(feeUsd, usdcUsd, decimals);

    const receiver = amountInt - feeInt;

    return {
      chainId: q.chainId,
      token: q.token,
      decimals,
      amount: q.amount,
      riceFee: {
        usd: feeUsd.toFixed(2),
        token: feeInt.toString(),
        policy: this.policy
      },
      gas: {
        limit: gasLimit.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        native: (Number(gasNative) / 1e18).toFixed(8),
        usd: gasUsd.toFixed(2),
        bufferedUsd: (gasUsd * 1.1).toFixed(2),
      },
      totals: {
        payerPays: { token: amountInt.toString(), gasNative: gasNative.toString() },
        receiverGets: { token: receiver.toString() }
      },
      quotes: {
        nativeUsd: nativeUsd.toFixed(2),
        usdcUsd: usdcUsd.toFixed(2),
        at: new Date().toISOString(),
        source
      },
      meta: { confidence: 'medium', reestimateHint: true }
    };
  }
}