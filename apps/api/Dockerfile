FROM node:22-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
RUN corepack enable

# 1) deps (workspace 설치 - dev 포함)
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# 2) build
FROM base AS build
COPY . .
COPY --from=deps /repo/node_modules ./node_modules

WORKDIR /repo/apps/api
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma
RUN pnpm build:prod

# ✅ 3) 런타임용으로 "api만" prod deps 포함해서 패키징
WORKDIR /repo
RUN pnpm --filter @ricepay/api deploy --prod /out

# 4) runtime
FROM node:22-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /out/ ./

EXPOSE 4000
CMD ["node", "dist/main.js"]