############################
# 1️⃣ base
############################
FROM node:22-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
RUN corepack enable

############################
# 2️⃣ deps (빌드용 의존성)
# - devDependencies 포함
############################
FROM base AS deps

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages

RUN pnpm install --frozen-lockfile

############################
# 3️⃣ build
############################
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

# prisma generate (schema 명시)
WORKDIR /app/apps/api
RUN pnpm prisma:generate --schema=./prisma/schema.prisma

# nest build
RUN pnpm build:prod

############################
# 4️⃣ prod-deps
# - runtime에 필요한 의존성만 재구성
############################
FROM base AS prod-deps

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages

# ⚠️ 핵심
# prod만 설치하지만 shared는 이미 build stage에서 빌드됨
RUN pnpm install --frozen-lockfile --prod

############################
# 5️⃣ runner (최종 이미지)
############################
FROM node:22-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app
ENV NODE_ENV=production

# prod deps
COPY --from=prod-deps /app/node_modules ./node_modules

# 빌드 결과물
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json

EXPOSE 4000
CMD ["node", "dist/main.js"]