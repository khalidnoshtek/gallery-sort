# Gallery Sort — Next.js app (multi-stage production build).
# Build:  docker build -t gallery-sort .
# Run:    docker run -p 127.0.0.1:3000:3000 \
#                  -v "$HOME/.gallery-sort:/data/.gallery-sort" \
#                  -v "/Volumes/SSD/Photos:/library:ro" \
#                  -e GALLERY_SORT_HOME=/data/.gallery-sort \
#                  -e DATABASE_URL="file:/data/.gallery-sort/gallery.db" \
#                  -e AI_SIDECAR_URL="http://host.docker.internal:7860" \
#                  gallery-sort
#
# Local-first reminder: this image is for self-hosted / home-server use.
# Desktop users should run via `pnpm dev` directly.

FROM node:20-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile=false --prod=false

FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

FROM node:20-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN groupadd --system --gid 1001 app \
 && useradd --system --uid 1001 --gid app app

COPY --from=build /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=app:app /app/node_modules/@prisma ./node_modules/@prisma

USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
