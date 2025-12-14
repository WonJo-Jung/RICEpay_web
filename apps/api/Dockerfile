FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm -w install --frozen-lockfile --prod=false

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm -w prisma:generate --schema=apps/api/prisma/schema.prisma
RUN pnpm -w build:prod

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/main.js"]