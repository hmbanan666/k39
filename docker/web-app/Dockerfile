FROM node:24.11.1-alpine AS base

# Builder stage
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web-app ./apps/web-app

# `npm install -g pnpm` installs current pnpm (12.x). That binary then
# re-execs the packageManager pin (10.25.0). The old build line was
# `pnpm build --filter @k39/web-app`, which runs the root script
# `pnpm -r run build` and appends `--filter` onto `nuxt build`.
# Corepack activates 10.25.0 directly. The filter belongs before the script.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @k39/web-app build

# Production stage
FROM base AS production
RUN apk add --no-cache curl
WORKDIR /app

# Copy built artifacts from builder. Migrations stay beside the server so
# the Nitro plugin can apply them on boot (Dokploy has no separate migrate step).
COPY --from=builder /app/apps/web-app/.output .
COPY --from=builder /app/packages/database/migrations /app/migrations
COPY docker/web-app/health-check.sh ./

# node:24-alpine already has user `node` (uid 1000). Adding another
# uid 1000 fails the image build. Dokploy should mount a volume at
# MEDIA_DIR if uploads must survive a redeploy.
RUN mkdir -p /app/media && \
    chown -R node:node /app && \
    chmod +x ./health-check.sh
USER node

# Configuration
ARG VERSION=nightly
LABEL maintainer="hmbanan666@hotmail.com" \
    description="k39 web app" \
    version=${VERSION}
ENV VERSION=${VERSION} \
    NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    MIGRATIONS_FOLDER=/app/migrations \
    MEDIA_DIR=/app/media

EXPOSE 3000

# Health check using exec form
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD ["./health-check.sh"]

# Run the application
ENTRYPOINT ["node"]
CMD ["/app/server/index.mjs"]
