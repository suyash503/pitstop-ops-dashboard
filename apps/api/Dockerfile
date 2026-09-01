# Build context is the REPO ROOT, not apps/api — npm workspaces hoist
# node_modules to the root, so the lockfile and root manifest have to come along.
#   docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS builder
WORKDIR /app

# Prisma needs OpenSSL to pick the right query engine on Alpine.
RUN apk add --no-cache openssl

# Manifests first: this layer is cached until dependencies actually change.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN npm ci

COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl tini

# node_modules is copied rather than reinstalled so the generated Prisma client
# and its query engine binary are exactly the ones the build was verified with.
# It also keeps the Prisma CLI available for `migrate deploy` on startup.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
EXPOSE 3001

# tini reaps zombies and forwards signals, so `docker compose down` is a clean
# shutdown rather than a 10-second SIGKILL wait.
ENTRYPOINT ["/sbin/tini", "--"]

# Migrations run on boot; seeding stays manual because the seed truncates.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
