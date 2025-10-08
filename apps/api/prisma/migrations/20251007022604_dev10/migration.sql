-- CreateTable
CREATE TABLE "SanctionedAddress" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SanctionedAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedCountry" (
    "code" TEXT NOT NULL,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedCountry_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ComplianceAudit" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "chain" TEXT,
    "address" TEXT,
    "ip" TEXT,
    "country" TEXT,
    "route" TEXT,
    "userId" TEXT,
    "reason" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SanctionedAddress_chain_address_idx" ON "SanctionedAddress"("chain", "address");

-- CreateIndex
CREATE UNIQUE INDEX "SanctionedAddress_chain_address_key" ON "SanctionedAddress"("chain", "address");

-- CreateIndex
CREATE INDEX "ComplianceAudit_type_status_createdAt_idx" ON "ComplianceAudit"("type", "status", "createdAt");
