# ADR 0005: Optional OAuth and apex redirect

## Status

Accepted

## Context

Dokploy already runs the app with `DATABASE_URL`, `NUXT_SESSION_PASSWORD`, and `NODE_ENV=production`. Yandex and VK OAuth apps are not configured yet. The public host should be `k39.online`, including requests that arrive on `www`.

## Decision

OAuth client id and secret default to empty strings. `/api/auth/providers` lists a provider only when both values are set. The sign-in page hides missing providers and explains that login is not connected. `/api/auth/yandex` and `/api/auth/vk` return 404 until configured. The process does not require those variables to boot.

A Nitro middleware redirects `www.k39.online` to `https://k39.online` with status 301, preserving path and query. It reads `X-Forwarded-Host` first. Other hosts, including localhost health checks, are not redirected.

Login providers are Yandex and VK only.

## Consequences

Bookmarks to `/api/auth/github` or Twitch from the old product 404. Until OAuth secrets exist, nobody can create a user from the UI. Session encryption still requires `NUXT_SESSION_PASSWORD` in production.
