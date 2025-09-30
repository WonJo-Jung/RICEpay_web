-- CreateTable
CREATE TABLE "ReceiptAudit" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptAudit_receiptId_idx" ON "ReceiptAudit"("receiptId");
