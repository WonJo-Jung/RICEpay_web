FROM node:22-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable

# 1) 전체 설치 + 빌드
FROM base AS build
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

COPY . .
WORKDIR /app/apps/api
RUN pnpm prisma:generate --schema=./prisma/schema.prisma
RUN pnpm build:prod

# 2) 런타임: api만 prod deps 설치 (여기서 @nestjs/core가 확실히 들어옴)
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages

# api만 prod 의존성 설치
RUN pnpm install --frozen-lockfile --prod --filter @ricepay/api...

# dist 복사
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]