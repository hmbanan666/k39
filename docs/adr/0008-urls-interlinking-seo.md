# ADR 0008: URLs, interlinking and crawlability

## Status

Accepted.

## Context

Search robots, Yandex first and Google second, should see a stable Russian-language site: one URL per document, real HTML on the first byte, and links a crawler can follow without running the client.

## Decision

Public URLs are lowercase Latin slugs with hyphens and no trailing slash.

- Place: `/{slug}` (example `/fort-11-denhoff`).
- Category hubs: `/forty`, `/zamki`, `/plyazhi`, `/kurorty`, `/muzei`, `/eda`. The slug is stored on the category row.
- Routes: `/marshruty/{slug}`. Collections: `/podborki/{slug}`. Quests: `/kvesty/{slug}`.
- Regions are a column on the place, not a path segment. A place page names the region and links to other published places in it.

Slug transliteration matches the fort seed: `й` to `y`, `х` to `h`, `ц` to `ts`, `ё` and `э` to `e`, `ы` to `y`, hard and soft signs dropped. Reserved slugs (hubs, `admin`, `api`, `map`, and the other names in `shared/seo.ts`) are rejected in the admin and the content API.

One redirect response reaches the final URL. `www` becomes the apex, `http` becomes `https` on the public host, a trailing slash is removed, `/place/{slug}` becomes `/{slug}`, `/quest/five-forts` becomes `/kvesty/pyat-fortov`, and `/map` or `/map/*` becomes `/forty` while the map flag is off. `slug_redirects` are followed inside that same response. A row with status 410 and no target returns 410. Query strings such as `utm_*` are kept on the redirect and stripped from `rel=canonical`. Yandex `Clean-param` and `Host` live in `public/robots.txt`. The robots module is told not to rewrite that file, because its generator drops the `Host` line.

Missing and unpublished places are HTTP 404, not an empty 200. Drafts are not in the sitemap. Editors open `/preview/{slug}` (login required, `noindex`, disallowed in robots.txt). Pagination `?page=` greater than 1 is `noindex` and its canonical is that page URL only. Any other query key except Yandex/Google click ids and `utm_*` is `noindex`; those tracking keys stay indexable and are listed in `Clean-param`.

Every public page is rendered on the server. The initial HTML contains the H1, the body, and plain `<a href>` lists. There is one H1. The title pattern is `{name} — {context} | K39` unless `seo_title` is set. Description uses `seo_description` or the summary. Open Graph and a Twitter card use an absolute image. `html lang` is `ru`.

JSON-LD is a `@graph`: Organization and WebSite on the home page, BreadcrumbList on every other public page, a type matched to the category (historical building, beach, museum, or tourist attraction) with geo and `sameAs` when known, CollectionPage plus ItemList for hubs and collections, TouristTrip for routes and quests. Place, route, and collection pages add FAQPage when the markdown body has a `## Частые вопросы` section. The questions are parsed by one helper, `faqFromBody` in `apps/web-app/shared/seo.ts`, and wrapped by `faqPageNode`. Quest pages do not pass that body into the helper.

Visible breadcrumbs match the BreadcrumbList. The header and footer link every hub. Home also links route, collection and quest indexes. A place links its hub, nearest places, same-region places, routes and collections that include it, and manual related rows. Anchor text is the place or section name. `apps/web-app/test/seo.test.ts` fails if a seeded public URL has no inbound link.

The sitemap source lists only published, indexable URLs, with `lastmod` and place images. One sitemap is enough at this size, so there is no sitemap index. `/admin`, `/api`, `/map`, `/sign-in` and `/preview` are disallowed in robots.txt. Each entity has `seo_title`, `seo_description`, `og_image` and `noindex`. Uploads may be WebP; dimensions are read from the file header without a transcoder. Images keep width and height attributes. The consent banner is `position: fixed`.

## Consequences

Changing a live slug must insert a redirect or the old URL 404s. The admin does that automatically. Coordinates are optional, but without them the page has no geo node and no nearest links.
