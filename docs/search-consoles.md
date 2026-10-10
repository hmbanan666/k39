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

## Dokploy

Set the verification variables on the web app and redeploy. They are public by design (they appear in HTML). Do not put them in the database.
