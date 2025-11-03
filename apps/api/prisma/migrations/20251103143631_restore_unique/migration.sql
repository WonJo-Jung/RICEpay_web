/*
  Warnings:

  - A unique constraint covering the columns `[shareToken]` on the table `Receipt` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[lastEventId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Receipt_shareToken_key" ON "Receipt"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_lastEventId_key" ON "Transaction"("lastEventId");
