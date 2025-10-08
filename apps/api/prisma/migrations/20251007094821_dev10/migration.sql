/*
  Warnings:

  - Added the required column `checksum` to the `SanctionedAddress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SanctionedAddress" ADD COLUMN     "checksum" TEXT NOT NULL;
