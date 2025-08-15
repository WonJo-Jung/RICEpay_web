-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."Chain" AS ENUM ('ETHEREUM', 'POLYGON', 'BASE', 'SOLANA');

-- CreateEnum
CREATE TYPE "public"."Currency" AS ENUM ('USD', 'RUSD');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('ONCHAIN', 'OFFCHAIN');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneE164" TEXT,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "country" TEXT,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "kycStatus" "public"."KycStatus" NOT NULL DEFAULT 'NONE',
    "kycAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AddressBookEntry" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain" "public"."Chain" NOT NULL,
    "note" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "payeeId" TEXT,
    "payeeAddress" TEXT,
    "chain" "public"."Chain",
    "currency" "public"."Currency" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL DEFAULT 0,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "public"."PaymentMethod" NOT NULL DEFAULT 'ONCHAIN',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "txHash" TEXT,
    "tokenSymbol" TEXT,
    "memo" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneE164_key" ON "public"."User"("phoneE164");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "public"."User"("status");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "public"."User"("kycStatus");

-- CreateIndex
CREATE INDEX "AddressBookEntry_ownerId_isFavorite_idx" ON "public"."AddressBookEntry"("ownerId", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "AddressBookEntry_ownerId_address_chain_key" ON "public"."AddressBookEntry"("ownerId", "address", "chain");

-- CreateIndex
CREATE INDEX "Payment_payerId_status_requestedAt_idx" ON "public"."Payment"("payerId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "Payment_payeeId_status_requestedAt_idx" ON "public"."Payment"("payeeId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "Payment_txHash_idx" ON "public"."Payment"("txHash");

-- CreateIndex
CREATE INDEX "Payment_currency_requestedAt_idx" ON "public"."Payment"("currency", "requestedAt");

-- AddForeignKey
ALTER TABLE "public"."AddressBookEntry" ADD CONSTRAINT "AddressBookEntry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
