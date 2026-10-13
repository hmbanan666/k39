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

One redirect response reaches the final URL. `www` becomes the apex, `http` becomes `https` on the public host, a trailing slash is removed, `/place/{slug}` becomes `/{slug}`, `/quest/five-forts` becomes `/kvesty/pyat-fortov`. The visitor map is `/map`. `/map/forty` and `/karta` are not redirected. `slug_redirects` are followed inside that same response. A row with status 410 and no target returns 410. Query strings such as `utm_*` are kept on the redirect and stripped from `rel=canonical`. Yandex `Clean-param` and `Host` live in `public/robots.txt`. The robots module is told not to rewrite that file, because its generator drops the `Host` line.

Missing, draft, and review pages are HTTP 404, not an empty 200. An archived route or collection is 410: `content_archive` writes a `slug_redirects` row with status 410 for `/marshruty/{slug}` or `/podborki/{slug}`. Publishing that slug deletes the 410 row. A hard-deleted draft does not write one, so that URL stays 404. Drafts and archived rows are not in the sitemap. Editors open `/preview/{slug}` (login required, `noindex`, disallowed in robots.txt). Pagination `?page=` greater than 1 is `noindex` and its canonical is that page URL only. Any other query key except Yandex/Google click ids and `utm_*` is `noindex`; those tracking keys stay indexable and are listed in `Clean-param`.

Every public page is rendered on the server. The initial HTML contains the H1, the body, and plain `<a href>` lists. There is one H1. When `seo_title` is set, the pattern is `{seoTitle} | K39`. Otherwise the title is `{title}: {intent} | K39` when that string is 15 to 70 characters, and `{title} | K39` when the intent would not fit. The intent names the page job (hours and how to get there, ordered stops, a themed list) and does not repeat a type word already in the title. The template does not insert an em dash. A stored title that already contains the brand is left as written. Description uses `seo_description` or the summary. A summary shorter than 50 characters gains a fact that is already on the page, then a K39 line, and is cut at 170. Open Graph and a Twitter card use an absolute image. A generated `og.jpg` reports that file's width and height. `html lang` is `ru`. `robots` includes `max-image-preview:large`. `geo.region` is `RU-KGD`.

JSON-LD is a `@graph`: Organization, with the measured moose logo, and WebSite on the home page. BreadcrumbList is on every other public page. A place is `TouristAttraction`, plus `LandmarksOrHistoricalBuildings`, `Beach`, or `Museum` when that category has a schema.org type. schema.org has no `Castle` type, so a castle stays a historical building. Geo and address are included when the row has them. `openingHours` is included only when the hours string is a whole day range the parser can turn into `Mo-Su 10:00-18:00` form. `isAccessibleForFree` is included only when the price string is unambiguously free or paid. CollectionPage plus ItemList covers hubs, collections, and venue lists. TouristTrip covers routes and quests, and its itinerary is an ItemList of stops. A stop `note` is the ItemList `description`. A cafe or coffee venue is `CafeOrCoffeeShop`. Other food venues are `Restaurant`. `priceRange`, `servesCuisine`, and `openingHoursSpecification` are set only from stored fields.

Place, route, collection, hub, and quest pages add FAQPage only when `faqPageNode` in `apps/web-app/shared/seo.ts` finds at least one answered question. It calls `faqFromBody` on the markdown body. That parser reads a section whose heading line is exactly `## Частые вопросы`. Inside it, a question is a line matching `**…?**` or a `###` heading. The answer is the remainder of that line, or the following non-empty lines until the next question or the next `##` heading. A `###` heading does not end the section. A bold line that is not a question is left out. The next `##` heading ends the section. Hub FAQ is read from `categories.body` (migration `0012_hub_body`). Quest FAQ is read from `quests.body`.

A quest page renders each step as a card. The card links to the place and shows the step prompt as the task. When the quest points at a published route, the page links to `/marshruty/{routeSlug}`. A draft route is not linked.

Visible breadcrumbs match the BreadcrumbList. The header and footer link every hub. Home also links route, collection and quest indexes. A place links its hub, nearest places, same-region places, routes and collections that include it, and manual related rows. Anchor text is the place or section name. `apps/web-app/test/seo.test.ts` fails if a seeded public URL has no inbound link.

The sitemap source lists only published, indexable URLs. `lastmod` is the row `updatedAt` for a place, route, collection, quest, venue, or listing intro. A hub uses the category `updatedAt`. A section index uses the newest child `updatedAt`. Legal pages have no `updatedAt` and omit `lastmod`. Place and venue galleries are image entries. One sitemap is enough at this size, so there is no sitemap index. `/admin`, `/api`, `/map`, `/sign-in` and `/preview` are disallowed in robots.txt. Each entity has `seo_title`, `seo_description`, `og_image` and `noindex`. Uploads may be WebP; dimensions are read from the file header without a transcoder. Images keep width and height attributes. The consent banner is `position: fixed`.

## Consequences

Changing a live slug must insert a redirect or the old URL 404s. The admin does that automatically. Coordinates are optional, but without them the page has no geo node and no nearest links. An archived route or collection stays 410 until that slug is published again.
