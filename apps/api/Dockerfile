FROM node:22-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM base AS build
# ✅ 루트 node_modules
COPY --from=deps /app/node_modules ./node_modules
# ✅ 패키지(node_modules/.bin 포함)도 같이
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY . .

# prisma + build (api 기준)
WORKDIR /app/apps/api
RUN pnpm prisma:generate --schema=./prisma/schema.prisma
RUN pnpm build:prod

# ✅ 배포용 아웃풋 생성 (prod deps만 포함된 "진짜" node_modules)
WORKDIR /app
# build stage 안에서
RUN npm i -g typescript
# 또는: RUN corepack enable && pnpm add -g typescript  (npm이 더 단순)
RUN pnpm --filter @ricepay/api deploy --prod /out

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# ✅ /out 안에는 package.json, node_modules, dist 등이 깔끔하게 들어있음
COPY --from=build /out/ ./

EXPOSE 4000
CMD ["node", "dist/main.js"]