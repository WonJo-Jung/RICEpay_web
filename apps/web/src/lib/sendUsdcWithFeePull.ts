// apps/web/src/lib/sendUsdcWithFeePull.ts
import RPT_ABI from '../../../../packages/contracts/abi/RicePayTransferPull.json';
import { alchemyChains } from './viem';
import { erc20Abi, withRetry } from '@ricepay/shared';
import type { Dispatch, SetStateAction } from 'react';
import {
  Abi,
  formatUnits,
  PublicClient,
  WalletClient,
} from 'viem';

export async function sendUsdcWithFeePull(
  params: {
    to: `0x${string}`;             // 최종 수취인
    amount6: bigint;               // 총액 (USDC 6 decimals)
    chainId: number;
    setTxState: Dispatch<SetStateAction<any>>;
  },
  addrs: {
    usdc: `0x${string}`;
    rpt:  `0x${string}`;           // RicePayTransferPull 주소
  },
  deps: {
    walletClient: WalletClient;
    publicClient: PublicClient;
  }
) {
  const { to, amount6, chainId, setTxState } = params;
  const { usdc, rpt } = addrs;
  const { walletClient, publicClient } = deps;

  const owner = walletClient.account!.address as `0x${string}`;

  // 0) 잔액/알로우언스 확인
  const [bal, alw] = await Promise.all([
    publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: 'balanceOf', args: [owner], authorizationList: [] }),
    publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: 'allowance', args: [owner, rpt], authorizationList: [] }),
  ]);

  // console.table({
  //   owner,
  //   to,
  //   amount6: amount6.toString(),
  //   balance: bal.toString(),
  //   allowanceToRPT: alw.toString(),
  // });

  if (bal < amount6) {
    throw Object.assign(new Error('INSUFFICIENT_USDC'), {
      ux: `USDC 잔액 부족: 필요 ${formatUnits(amount6 - bal, 6)} USDC, 보유 ${formatUnits(bal, 6)} USDC`,
    });
  }

  // 1) 최소 금액/수수료 클램프 미리 확인(컨트랙트의 quote 사용)
  try {
    const [fee, net] = await publicClient.readContract({
      address: rpt,
      abi: RPT_ABI as Abi,
      functionName: 'quote',
      args: [amount6],
      authorizationList: [],
    }) as [bigint, bigint];

    if (fee > amount6) {
      throw Object.assign(new Error('FEE_TOO_HIGH'), {
        ux: `수수료(${formatUnits(fee, 6)} USDC)가 총액(${formatUnits(amount6, 6)} USDC)보다 큼`,
      });
    }

    // (선택) UX 프리뷰
    console.log(`fee=${formatUnits(fee, 6)} USDC, net=${formatUnits(net, 6)} USDC`);
  } catch (err) {
    // quote가 없거나 실패하면 무시 가능 (컨트랙트에서 최종적으로 막힘)
    console.warn('quote failed (will rely on onchain checks):', err);
  }

  // 2) 알로우언스 부족시 approve (spender = RPT)
  if (alw < amount6) {
    const approveAbi = [
      {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount',  type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      },
    ] as const;

    const approveHash = await walletClient.writeContract({
      address: usdc,
      abi: approveAbi as Abi,
      functionName: 'approve',
      args: [rpt, 2n ** 256n - 1n], // 무제한 승인(운영정책에 따라 정확액으로 바꿔도 됨)
      account: owner,
      chain: alchemyChains[chainId],
    });
    await withRetry(() =>
      publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 })
    );
    console.log('approve confirmed:', approveHash);
  }

  // 3) 가스/수수료 사전 계산 (실제 호출 함수로!)
  const gas = await publicClient.estimateContractGas({
    address: rpt,
    abi: RPT_ABI as Abi,
    functionName: 'transferWithFee',
    args: [to, amount6],
    account: owner,
    chain: alchemyChains[chainId],
  });

  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();
  const needWei = gas * (maxFeePerGas ?? 0n);
  const ethBal = await publicClient.getBalance({ address: owner });

  if (maxFeePerGas && ethBal < needWei) {
    const need = Number(needWei) / 1e18;
    throw Object.assign(new Error('INSUFFICIENT_GAS'), {
      ux: `가스비 부족: 약 ${need.toFixed(6)} ETH 필요 (잔액 ${Number(ethBal)/1e18} ETH)`,
    });
  }

  // 4) 실제 트랜잭션 전송
  const hash = await walletClient.writeContract({
    chain: alchemyChains[chainId],
    address: rpt,
    abi: RPT_ABI as Abi,
    functionName: 'transferWithFee',
    args: [to, amount6],
    account: owner,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

  setTxState({ status: 'pending', hash });

  const receipt = await withRetry(() =>
    publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
  );

  return { hash, receipt };
}