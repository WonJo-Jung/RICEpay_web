"use client"

import { Dispatch, SetStateAction, useCallback } from 'react'
import { erc20Abi, assertAddress, toUserMessage, withRetry, PreflightResponse, TxRecord, ComplianceErrorBody, getComplianceMessage } from '@ricepay/shared'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { parseUnits, formatUnits, formatEther } from 'viem'
import { txPost } from "../lib/tx"
import { TransferResult } from '../lib/tx'
import { alchemyChains } from '../lib/viem'
import { sendUsdcWithFeePull } from '../lib/sendUsdcWithFeePull'

// ✅ 공통 상수
const USDC = process.env.NEXT_PUBLIC_USDC_ADDR as `0x${string}`
const DECIMALS = 6

export function useUSDC({ setTxState }: { setTxState: Dispatch<SetStateAction<{}>> }) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  // ✅ 잔액 확인
  const getBalance = useCallback(async (addr?: `0x${string}`) => {
    if (!publicClient || !(addr ?? address)) return ['something wrong']
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
    async (to: `0x${string}`, amount: string, chainId: number): Promise<TransferResult> => {
      try {
        if (!walletClient) throw Object.assign(new Error("WALLET_NOT_CONNECTED"), {
          ux: "지갑과 연결되지 않았어요."
        })

        // 1) 주소 포맷 확인
        assertAddress(to)

        // 2) 지오펜싱, 제재리스트 검토
        const { status, data: pre } = await txPost<PreflightResponse>('/compliance/preflight', {
          chain: alchemyChains[chainId].name, to
        });

        // 차단: /tx 호출하지 않음. 표준 바디로 result에 실어 배너로 노출.
        if (status === 200 && pre && pre.ok === false) {
          if (pre.type === 'GEOFENCE') {
            return {
              compliance: {
                kind: 'error',
                status: 451,
                data: {
                  ok: false,
                  type: 'GEOFENCE',
                  reason: pre.reason,
                  country: pre.country ?? null,
                  region: pre.region ?? null,
                  level: pre.region ? "REGION" : "COUNTRY"
                },
                msg: getComplianceMessage("preflight", 451, "ko")
              }
            };
          } else if ("checksum" in pre) {
            // type === 'SANCTIONS'
            return {
              compliance: {
                kind: 'error',
                status: 403,
                data: pre,
                msg: getComplianceMessage("preflight", 403, "ko")
              }
            };
          } else {
            // type === 'SANCTIONS'
            return {
              compliance: {
                kind: 'error',
                status: 503,
                data: pre,
                msg: getComplianceMessage("preflight", 503, "ko")
              }
            };
          }
        }

        // 3) 가스비 추정 & ETH 잔액 확인 + 4) 트랜잭션 실행 + 5) 1컨펌 기다리기
        const { hash, receipt } = await sendUsdcWithFeePull(
          {
            to,
            amount6: parseUnits(amount, DECIMALS),
            chainId,
            setTxState,
            // (옵션) nonce/deadlineSec 필요 시 지정
          },
          {
            usdc: process.env.NEXT_PUBLIC_USDC_ADDR as `0x${string}`,
            rpt: process.env.NEXT_PUBLIC_RPT_ADDR as `0x${string}`,
          },
          {
            walletClient,
            publicClient,
          }
        );

        // 6) 요약 데이터 만들기
        const { gasUsed, effectiveGasPrice, blockNumber, from } = receipt
        const feeWei =
          gasUsed * (effectiveGasPrice ?? (await publicClient.getGasPrice()))
        const feeEth = formatEther(feeWei)

        const summary = {
          status: receipt.status === "success" ? "success" : "failed",
          hash,
          blockNumber: Number(blockNumber),
          feeEth,
          transfer: { from, to, value: Number(amount) },
        }

        setTxState(summary)

        // 7) 트랜잭션 테이블에 기록(/tx). 서버 가드가 최종 판정(451/403/503,201).
        const res = await txPost<TxRecord | ComplianceErrorBody>('/tx', {
          txHash: hash,
          from,
          to,
          token: USDC,
          amount,          // "12.34" 같은 10진 문자열
          chainId,
          gasPaid: feeEth,
        });

        if (res.ok && (res.status === 200 || res.status === 201)) {
          return { hash, compliance: { kind: 'success', record: res.data as TxRecord, msg: getComplianceMessage("complianceGuard", 201, "ko") } };
        } else {
          const d = (res.data as ComplianceErrorBody);
          const code = d.type === "GEOFENCE" ? 451 : "checksum" in d ? 403 : 503;
          return {
            hash,
            compliance: {
              kind: 'error',
              status: res.status,
              data: d,
              msg: getComplianceMessage("complianceGuard", code, "ko")
            }
          };
        }
      } catch (err) {
        // 7) 에러 메시지 정규화
        const message = toUserMessage(err)
        setTxState({ status: "failed", errMsg: message });
        return { hash: undefined, compliance: null }
      }
    },
    [walletClient, publicClient]
  )

  return { getBalance, transfer }
}
