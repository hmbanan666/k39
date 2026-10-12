# ADR 0013: First-party analytics

## Status

Accepted.

ADR 0004 still governs `POST /api/events`: that table stores a consented session id and nothing else. This record adds page analytics in Postgres. No third-party tracker is loaded.

## Context

Editors need visitors, channels, landing pages, and search queries without sending traffic to an outside analytics host. 152-FZ rules out a raw IP address and any account id on a page view. Yandex and Google do not put the search query in the referrer, so those numbers have to be pulled from Webmaster and Search Console.

## Decision

`public/collect.js` is a deferred beacon under 2 KB. It does not change layout. It queues page views, engaged time (`visibilitychange` and a 15s heartbeat), scroll-depth buckets, outbound clicks (`[data-track]`), and photo-viewer opens, then `POST`s them with `sendBeacon` to `/api/collect`. A Nuxt client plugin reports client-side route changes the same way. Bots are recorded on the HTML request. Browsers without JavaScript hit a 1×1 `GET /api/collect.gif`.

The public site shows `CookieNotice`, a client-only bar with one button, «Хорошо». It does not offer a consent choice and does not set a cookie. Dismiss writes `localStorage` key `k39_cookie_notice`. `NUXT_PUBLIC_CONSENT_BANNER` stays off until user cabinets exist. Every visitor is cookieless. The visitor key is `HMAC-SHA256(ANALYTICS_SALT, UTC date + IP + User-Agent)` truncated to 32 hex characters, so it rotates daily. The IP is used only for that hash and is not stored. A new session id is issued when the previous hit for that key is older than 30 minutes. The only persistent cookie is `nuxt-session`, and only for an editor who has signed in. `POST /api/events` no longer sets `k39_sid`. If the banner flag is later turned on, a granted consent may set `k39_vid` and `k39_sid`. While the flag is off, a collect request deletes those cookies if they are still present.

Each stored hit has path, place id and route id when the path matches, referrer and referrer host, UTM fields, channel (`organic:yandex`, `organic:google`, `organic:other`, `social:vk`, `social:tg`, `social:other`, `direct`, `referral`, `internal`, `paid`), the search query when the referrer still has `q`, `text`, `query`, `p`, or `wd`, device, browser, OS from a small in-repo User-Agent parser, screen-width bucket, language, landing path, entry and exit flags, engaged milliseconds, and scroll bucket. Country and region are not collected: a GeoLite database is heavier than this needs.

Bots are dropped from reports. A hit is a bot when the User-Agent matches a short crawler list, or when a server-side hit has no `Accept-Language` (a no-JS browser still sends that header). Signed-in editors and admins are not recorded.

Raw rows live in `analytics_hits` for 13 months. `analytics_daily` keeps page views, visitors, sessions, bounces, engaged time, outbound clicks, and photo opens per day, path, channel, and device, and is not deleted. Visitor totals older than 13 months are sums of daily uniques, so they over-count people who return on another day. A process-local daily job purges raw rows, writes the rollup, and pulls search queries. It does nothing harmful when the search credentials are absent.

Search import, once a day, into `analytics_search_queries`:

- Yandex Webmaster. `YANDEX_WEBMASTER_TOKEN` is an OAuth token with Webmaster read access. `YANDEX_WEBMASTER_HOST_ID` is the host id from `GET /v4/user/{user-id}/hosts` (often `https:k39.online:443`). The user id is read from `GET /v4/user`. Popular queries are stored with an empty page because that endpoint is site-wide.
- Google Search Console. Either `GSC_SERVICE_ACCOUNT_JSON` (the JSON key; add that client email on the property) or `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, and `GSC_REFRESH_TOKEN`. `GSC_SITE_URL` is the URL-prefix property, `https://k39.online/`. The call is `searchAnalytics.query` grouped by date, query, and page. Scope: `https://www.googleapis.com/auth/webmasters.readonly`.

`ANALYTICS_SALT` should be a long random string. If it is empty the server uses `NUXT_SESSION_PASSWORD`.

MCP tools are read-only and each call inserts an `mcp_audits` row: `analytics_overview`, `analytics_channels`, `analytics_top_pages`, `analytics_landing_pages`, `analytics_referrers`, `analytics_search_queries`, `analytics_events`, `analytics_realtime`, `analytics_page`. `/admin/analytics` shows the same figures with Reka UI and the existing tokens. There is no chart library.

## Consequences

The beacon runs for every visitor and does not set a cookie. `useTrack()` stays quiet while the banner flag is off, so the old consented `events` table receives nothing from the public site. Set `ANALYTICS_SALT` before production traffic so a session-password rotation does not reshuffle the daily keys.
