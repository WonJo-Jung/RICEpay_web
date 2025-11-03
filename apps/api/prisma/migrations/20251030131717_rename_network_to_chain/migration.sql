/*
  Warnings:

  - You are about to drop the column `network` on the `Receipt` table. All the data in the column will be lost.
  - You are about to drop the column `network` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `chain` to the `Receipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chain` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- ALTER TABLE "Receipt" DROP COLUMN "network",
-- ADD COLUMN     "chain" TEXT NOT NULL;

-- AlterTable
-- ALTER TABLE "Transaction" DROP COLUMN "network",
-- ADD COLUMN     "chain" TEXT NOT NULL;

-- 1) 새 컬럼 추가 (nullable)
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "chain" TEXT;
ALTER TABLE "Receipt"     ADD COLUMN IF NOT EXISTS "chain" TEXT;

-- 2) 기존 데이터 백필 (network → chain)
UPDATE "Transaction" SET "chain" = "network" WHERE "chain" IS NULL;
UPDATE "Receipt"     SET "chain" = "network" WHERE "chain" IS NULL;

-- 4) network 컬럼 제거
ALTER TABLE "Transaction" DROP COLUMN "network";
ALTER TABLE "Receipt" DROP COLUMN "network";