"use client"

import { Dispatch, SetStateAction, useCallback } from 'react'
import { erc20Abi, assertAddress, toUserMessage, withRetry } from '@ricepay/shared'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { parseUnits, formatUnits, formatEther, parseAbiItem } from 'viem'
import { BASE_SEPOLIA } from '@ricepay/shared'

// ✅ 공통 상수
const USDC = process.env.NEXT_PUBLIC_USDC_ADDR as `0x${string}`
const DECIMALS = 6

export function useUSDC({ setTxState }: { setTxState: Dispatch<SetStateAction<{}>> }) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  // ✅ 잔액 확인
  const getBalance = useCallback(async (addr?: `0x${string}`) => {
    if (!publicClient || !(addr ?? address)) return '0'
    try {
      const bal = await publicClient.readContract({
        abi: erc20Abi,
        address: USDC,
        functionName: 'balanceOf',
        args: [addr ?? address!],
      })
      const wei = await publicClient.getBalance({ address });
      return [formatUnits(bal as bigint, DECIMALS), formatEther(wei)];
    } catch (err) {
      throw new Error(toUserMessage(err))
    }
  }, [publicClient, address])

  // ✅ 송금 (에러 처리 추가 버전)
  const transfer = useCallback(
    async (to: string, amount: string) => {
      try {
        if (!walletClient) throw Object.assign(new Error("WALLET_NOT_CONNECTED"), {
          ux: "지갑과 연결되지 않았어요."
        })

        // 1) 주소 포맷 확인
        assertAddress(to)

        // 2) 네트워크 확인
        const currentChainId = await walletClient.getChainId?.()
        if (currentChainId !== BASE_SEPOLIA.id) {
          throw Object.assign(new Error("WRONG_NETWORK"), {
            ux: "Base Sepolia 네트워크로 전환해 주세요.",
          })
        }

        // 3) 가스비 추정 & ETH 잔액 확인
        const amt = parseUnits(amount, DECIMALS)
        const gas = await withRetry(() => publicClient.estimateContractGas({
          account: walletClient.account!,
          address: USDC,
          abi: erc20Abi,
          functionName: "transfer",
          args: [to as `0x${string}`, amt],
        }))
        const gasPrice = await withRetry(() => publicClient.getGasPrice());
        const needWei = gas * gasPrice
        const ethBal = await publicClient.getBalance({
          address: walletClient.account!.address,
        })
        if (ethBal < needWei) {
          throw Object.assign(new Error("INSUFFICIENT_GAS"), {
            ux: `가스비 부족: 약 ${formatEther(needWei)} ETH 필요`,
          })
        }

        // 4) 트랜잭션 실행
        const hash = await walletClient.writeContract({
          chain: BASE_SEPOLIA,
          abi: erc20Abi,
          address: USDC,
          functionName: "transfer",
          args: [to as `0x${string}`, amt],
          account: walletClient.account,
        })

        setTxState({ status: "pending", hash })

        // 5) 1컨펌 기다리기
        const receipt = await withRetry(() => publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        }))

        // 6) 요약 데이터 만들기
        const { gasUsed, effectiveGasPrice, blockNumber } = receipt
        const feeWei =
          gasUsed * (effectiveGasPrice ?? (await publicClient.getGasPrice()))
        const feeEth = formatEther(feeWei)

        // Transfer 이벤트 파싱
        const TransferEvt = parseAbiItem(
          "event Transfer(address indexed from, address indexed to, uint256 value)"
        )
        const logs = await withRetry(() => publicClient.getLogs({
          address: USDC,
          event: TransferEvt,
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        }))
        const { from, to: toTX, value } = logs[0].args

        const summary = {
          status: receipt.status === "success" ? "success" : "failed",
          hash,
          blockNumber: Number(blockNumber),
          feeEth,
          explorerUrl: `https://sepolia-explorer.base.org/tx/${hash}`,
          transfer: { from, to: toTX, value: Number(value) },
        }

        setTxState(summary)
      } catch (err) {
        // 7) 에러 메시지 정규화
        const message = toUserMessage(err)
        setTxState({ status: "failed", errMsg: message })
      }
    },
    [walletClient, publicClient]
  )

  return { getBalance, transfer }
}
