/*
  Warnings:

  - You are about to drop the column `fromLabel` on the `Receipt` table. All the data in the column will be lost.
  - You are about to drop the column `toLabel` on the `Receipt` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Receipt" DROP COLUMN "fromLabel",
DROP COLUMN "toLabel";
