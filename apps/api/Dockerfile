# apps/api/Dockerfile
FROM node:22-bookworm-slim

# 필수 런타임
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app
RUN corepack enable

# workspace 전체 복사
COPY . .

# 전체 의존성 설치 (dev 포함)
RUN pnpm install --frozen-lockfile

# prisma generate (schema 위치 명시)
WORKDIR /app/apps/api
RUN pnpm prisma:generate --schema=./prisma/schema.prisma

# nest build
RUN pnpm build:prod

EXPOSE 4000
CMD ["node", "dist/main.js"]