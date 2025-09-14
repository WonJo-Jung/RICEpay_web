# RICE Pay — US→MX Corridor MVP (Monorepo)

TypeScript monorepo for **non-custodial** USDC remittance MVP.

## Packages

- `apps/web` — Next.js 14 (PWA) dashboard + checkout
- `apps/api` — NestJS API (invoices/payments/address-book)
- `apps/app` — React Native (Expo) sender app
- `packages/config` — eslint/prettier/tsconfig base

## Quick Start

```bash
pnpm i
pnpm dev
```

See each app's README for environment variables.
