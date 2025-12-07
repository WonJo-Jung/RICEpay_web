// apps/api/src/tx/status/tx.handler.ts
import { prisma } from "../../lib/db";
import { NotificationsService } from "../../notifications/notifications.service"; // 경로는 네 구조에 맞춰 조정

export async function handleTxConfirmed(
  { from, amount, asset, id, to, txHash, fee }: { from: string; amount: string; asset: string; id: string; to: string; txHash: string; fee: string; },
  notificationsService: NotificationsService,
) {
  // 송금자 알림
  await notificationsService.createAndSend({
    wallet: from,
    type: "TRANSFER_COMPLETED",
    title: "Sending complete",
    body: `${amount} ${asset} has been sent`,
    data: {
      txId: id,
      txHash: txHash,
      to,
      amount,
      asset,
      fee,
    },
  });

  // 수신자도 RicePay 유저라면 알림
  const receiverHasDevice = await prisma.device.count({
    where: { wallet: to },
  });

  if (receiverHasDevice > 0) {
    await notificationsService.createAndSend({
      wallet: to,
      type: "TRANSFER_RECEIVED",
      title: "Receiving complete",
      body: `${amount} ${asset} has been received`,
      data: {
        txId: id,
        txHash: txHash,
        from,
        amount,
        asset,
        fee,
      },
    });
  }
}
