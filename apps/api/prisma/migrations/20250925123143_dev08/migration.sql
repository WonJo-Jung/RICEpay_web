-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "token" TEXT,
    "amount" TEXT,
    "status" TEXT NOT NULL,
    "blockNumber" INTEGER,
    "confirmations" INTEGER DEFAULT 0,
    "lastEventId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txHash_key" ON "Transaction"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_lastEventId_key" ON "Transaction"("lastEventId");
