/*
  Warnings:

  - Made the column `chain` on table `Receipt` required. This step will fail if there are existing NULL values in that column.
  - Made the column `chain` on table `Transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Receipt" ALTER COLUMN "chain" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "chain" SET NOT NULL;
