/*
  Warnings:

  - You are about to drop the column `reason` on the `ComplianceAudit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BlockedCountry" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ComplianceAudit" DROP COLUMN "reason",
ADD COLUMN     "region" TEXT,
ADD COLUMN     "rule" TEXT,
ADD COLUMN     "version" TEXT;

-- AlterTable
ALTER TABLE "SanctionedAddress" ADD COLUMN     "version" TEXT,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "BlockedRegion" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "pattern" TEXT,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "key" TEXT NOT NULL,
    "version" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "BlockedRegion_country_region_idx" ON "BlockedRegion"("country", "region");
