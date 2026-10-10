# ADR 0006: Corepack pnpm in the web image

## Status

Accepted

## Context

Dokploy builds `docker/web-app/Dockerfile` on Alpine Node 24. The image used `npm install -g pnpm`, which installs whatever pnpm is current (12.x as of this writing). The root `packageManager` field pins `pnpm@10.25.0`, so that newer binary downloads 10.25.0 and re-execs it. The build line was `pnpm build --filter @k39/web-app`. The root `build` script is `pnpm -r run build`, and pnpm appends arguments after the script name, so the web app was built as `nuxt build --filter @k39/web-app`. That deploy failed with `ELIFECYCLE` exit code -8 (Docker status 248).

A sibling app (kosarev.space) builds with `corepack enable pnpm`, a separate install step, and `pnpm --filter <pkg> build`.

## Decision

The web image enables pnpm through Corepack so the version is the pin in `packageManager`, not npm's latest. Install and build are separate `RUN` steps. The build command is `pnpm --filter @k39/web-app build`. CI builds the same Dockerfile on pull requests. The base image stays `node:24.11.1-alpine` so the existing `apk` healthcheck curl stays valid. The runtime user owns `/app`, because Nuxt Content creates a sqlite database in the workdir on boot.

## Consequences

Corepack must be able to download pnpm during the image build. Changing `packageManager` means the image follows that pin on the next build. A Dockerfile-only change is no longer ignored by CI path filters.
