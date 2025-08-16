"use client"

import { Dispatch, SetStateAction, useCallback, useState } from 'react'
import { erc20Abi } from '@ricepay/shared'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { parseUnits, formatUnits, formatEther, parseAbiItem } from 'viem'
import { BASE_SEPOLIA } from '@ricepay/shared'

const USDC = process.env.NEXT_PUBLIC_USDC_ADDR as `0x${string}`
const DECIMALS = 6

export function useUSDC({ setTxState }: { setTxState: Dispatch<SetStateAction<{}>> }) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const balanceOf = useCallback(async (addr?: `0x${string}`) => {
    if (!publicClient || !(addr ?? address)) return '0'
    const bal = await publicClient.readContract({
      abi: erc20Abi,
      address: USDC,
      functionName: 'balanceOf',
      args: [addr ?? address!],
    })
    const wei = await publicClient.getBalance({ address });
    return [formatUnits(bal as bigint, DECIMALS), formatEther(wei)];
  }, [publicClient, address])

  const transfer = useCallback(async (to: `0x${string}`, amount: string) => {
    if (!walletClient) throw new Error('Wallet not connected')

    const hash = await walletClient.writeContract({
      chain: BASE_SEPOLIA,
      abi: erc20Abi,
      address: USDC,
      functionName: 'transfer',
      args: [to, parseUnits(amount, DECIMALS)],
      account: walletClient.account
    });
    setTxState({ status: 'pending', hash });

    // 1컨펌 기다리며 상태 업데이트
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    // 요약 데이터 만들기
    const { gasUsed, effectiveGasPrice, blockNumber } = receipt
    const feeWei = gasUsed * (effectiveGasPrice ?? (await publicClient.getGasPrice()))
    const feeEth = formatEther(feeWei)

    // Transfer 이벤트 파싱
    const TransferEvt = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
    const logs = await publicClient.getLogs({
      address: USDC,
      event: TransferEvt,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    })
    
    const {from, to: toTX, value} = logs[0].args
    const summary = {
      status: receipt.status === 'success' ? 'success' : 'failed',
      hash,
      blockNumber: Number(blockNumber),
      feeEth,
      explorerUrl: `https://sepolia-explorer.base.org/tx/${hash}`,
      transfer: {from, to: toTX, value: Number(value)}
    };

    setTxState(summary);
  }, [walletClient, publicClient])

  return { balanceOf, transfer }
}
