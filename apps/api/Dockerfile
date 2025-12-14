# apps/api/Dockerfile
FROM node:22-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
RUN corepack enable

# 1) deps: 전체 workspace 의존성 설치 (dev 포함)
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm install

# 2) build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 🔥 핵심: api 디렉토리로 이동해서 prisma 실행
WORKDIR /app/apps/api
RUN pnpm prisma:generate
RUN pnpm build:prod

# 3) runtime
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 4000
CMD ["node", "dist/main.js"]