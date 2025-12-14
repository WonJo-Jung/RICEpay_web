# apps/api/Dockerfile
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

# 1) 빌드용 deps (dev 포함)
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm -w install --frozen-lockfile --prod=false

# 2) 빌드
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma client 생성 (중요)
RUN pnpm -w --filter @ricepay/api prisma:generate
RUN pnpm -w --filter @ricepay/api build:prod

# 3) 런타임 deps (prod만)
FROM base AS prod-deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm -w install --frozen-lockfile --prod

# 4) 런타임
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# 런타임에 필요한 것만 복사
COPY --from=build /app/apps/api/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./package.json

EXPOSE 4000
CMD ["node", "dist/main.js"]