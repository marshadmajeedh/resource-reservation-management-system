# syntax=docker/dockerfile:1

# Stage 1: Base image with Node 24 on Debian Bookworm Slim
FROM node:24-bookworm-slim AS base
WORKDIR /app

# Stage 2: Dependencies installation
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.yarnpkg.com && npm ci --ignore-scripts

# Stage 3: Builder for Prisma Client and Next.js production build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables (strictly without credentials/secrets)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client for PostgreSQL adapter
RUN npm run prisma:generate

# Build Next.js production bundle
RUN npm run build

# Prune development dependencies to keep production footprint minimal
RUN npm prune --omit=dev

# Stage 4: Production runner image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy assets and production dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Ensure entrypoint is executable and transfer ownership to non-root node user
RUN chmod +x ./docker-entrypoint.sh && chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
