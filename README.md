# K39

Russian-language site for places in Kaliningrad Oblast: one page per place, illustrated SVG maps, routes, and quests. Local businesses will later attach pay-per-result offers. This repository is the clean base for that product.

The previous social product (reviews, follows, pins, feed, advent calendar, badges) has been removed.

## Develop

```bash
pnpm install
cp apps/web-app/.env.example apps/web-app/.env
pnpm --filter @k39/web-app dev
```

The app listens on port 3000. Public pages are rendered from Postgres, so set `DATABASE_URL` before `pnpm dev`. On startup the server applies Drizzle migrations and upserts the initial place seed. Login needs the optional OAuth variables.

## Check

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Database tests use `DATABASE_URL` when it points at localhost. Otherwise they start Postgres with Testcontainers (Docker).

## Deploy

Dokploy builds `docker/web-app/Dockerfile` with the repository root as context, exposes port 3000, and auto-deploys pushes to `main`. The image uses Corepack to install `pnpm@10.25.0` and runs `pnpm --filter @k39/web-app build`. Set `DATABASE_URL`, `NODE_ENV=production`, and `NUXT_SESSION_PASSWORD` (or `NUXT_APP_SECRET` when the session password is unset). Yandex and VK OAuth variables are optional. Pull requests also build this image in CI.

See [AGENTS.md](AGENTS.md) for architecture and conventions.
