-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "fiatCurrency" TEXT NOT NULL,
    "fiatRate" DECIMAL(65,30) NOT NULL,
    "fiatAmount" DECIMAL(65,30) NOT NULL,
    "gasPaid" DECIMAL(65,30),
    "gasFiatAmount" DECIMAL(65,30),
    "appFee" DECIMAL(65,30),
    "appFeeFiat" DECIMAL(65,30),
    "policyVersion" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "fromLabel" TEXT,
    "toLabel" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "shareToken" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_transactionId_key" ON "Receipt"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_shareToken_key" ON "Receipt"("shareToken");

-- CreateIndex
CREATE INDEX "Receipt_fromAddress_idx" ON "Receipt"("fromAddress");

-- CreateIndex
CREATE INDEX "Receipt_toAddress_idx" ON "Receipt"("toAddress");

-- CreateIndex
CREATE INDEX "Receipt_confirmedAt_idx" ON "Receipt"("confirmedAt");
