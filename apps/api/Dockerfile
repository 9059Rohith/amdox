# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @amdox/db prisma generate
RUN pnpm --filter @amdox/api build

# ---- Stage 3: Production (Distroless) ----
FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app

# Copy built output
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/db/prisma ./prisma

# Non-root user (distroless uses nonroot by default)
USER nonroot

EXPOSE 3000
ENV NODE_ENV=production

CMD ["dist/main.js"]
