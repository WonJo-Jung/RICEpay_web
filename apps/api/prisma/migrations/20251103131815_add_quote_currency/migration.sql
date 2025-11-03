/*
  Warnings:

  - Added the required column `quoteCurrency` to the `Receipt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "quoteCurrency" TEXT NOT NULL;
