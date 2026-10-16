# Search consoles

Do this after the site answers on `https://k39.online`. Nothing here is configured in the repo beyond empty env placeholders.

## Yandex Webmaster

1. Add the site `https://k39.online` (apex, https, no www).
2. Verify by meta tag. Put the token in `NUXT_PUBLIC_YANDEX_VERIFICATION` and redeploy. The tag is `<meta name="yandex-verification" content="...">`.
3. Set the region to Kaliningrad / Kaliningrad Oblast.
4. Submit `https://k39.online/sitemap.xml`.
5. Check that `www` and `http` URLs redirect once to the apex, and that `/place/fort-11-denhoff` redirects once to `/fort-11-denhoff`. `/preview` and `/admin` must stay out of the index.
6. Leave `Clean-param` in `robots.txt` as shipped. Do not add the same parameters as extra Webmaster rules unless a report shows duplicates.

## Google Search Console

1. Add the URL-prefix property `https://k39.online`.
2. Verify by meta tag. Put the token in `NUXT_PUBLIC_GOOGLE_VERIFICATION`.
3. Submit the same sitemap.
4. Inspect `/fort-11-denhoff` and `/forty` and confirm the rendered HTML contains the H1 and canonical.

## Query import

The site pulls queries into Postgres once a day. The job checks every hour and marks the day done only after every configured engine succeeds, so a failed import retries on the next hour. If the variables below are empty, that engine is skipped and the rest of the site keeps running. Steps for creating the tokens are in ADR 0013.

Yandex Webmaster:

1. Create an OAuth token that can read Webmaster (`https://oauth.yandex.ru`, access to the Webmaster API).
2. Call `GET https://api.webmaster.yandex.net/v4/user` with `Authorization: OAuth <token>` and then `GET /v4/user/{user-id}/hosts`.
3. Copy the host id. For this site it looks like `https:k39.online:443`.
4. Set `YANDEX_WEBMASTER_TOKEN` and `YANDEX_WEBMASTER_HOST_ID` on the web app. The host id is `https:k39.online:443` for the apex. A URL or an http mirror is accepted: the job picks the verified host with the same name. The import asks for a week that ends three days ago, because a range through yesterday comes back with no queries. If either variable is empty, Yandex is skipped and only Google rows are stored.

Google Search Console, one of these:

- Service account: create a JSON key, put the file contents in `GSC_SERVICE_ACCOUNT_JSON`, and add the client email as a user on the property `https://k39.online/`. Scope used by the job: `https://www.googleapis.com/auth/webmasters.readonly`.
- OAuth: set `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, and `GSC_REFRESH_TOKEN` for a user who can read that property.

Also set `GSC_SITE_URL`. For a domain property use `sc-domain:k39.online`; a URL-prefix value such as `https://k39.online/` also works, because the job falls back to the readable property on the same host. On the first run with no Google rows the job backfills 90 days.

`ANALYTICS_SALT` is a long random string. The daily cookieless visitor hash uses it. Without it the server falls back to `NUXT_SESSION_PASSWORD`.

## Dokploy

Set the verification variables on the web app and redeploy. They are public by design (they appear in HTML). Do not put them in the database.
