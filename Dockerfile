# --- Next.js frontend (dev container) ---
# Build context is the repo root (docker-compose.yml: `build: .`), since
# package.json, prisma/, and src/ all live there directly.

FROM node:20-alpine

# openssl/libc6-compat: needed for Prisma's query engine on alpine
# postgresql-client: gives docker-entrypoint.sh pg_isready/psql for the
# wait-for-db and seed-check logic
RUN apk add --no-cache openssl libc6-compat postgresql-client

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN --mount=type=cache,target=/root/.npm npm install --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
