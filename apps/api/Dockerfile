# apps/api/Dockerfile
FROM node:22-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
RUN corepack enable

# 1) deps: repo 전체 복사 후 install (workspace 구조 보장)
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

# 2) build
FROM base AS build
COPY --from=deps /app /app

WORKDIR /app/apps/api
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma
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