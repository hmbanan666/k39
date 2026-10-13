# SEO audit

Audited on 13 October 2026 against the live HTML of https://k39.online and the generators in `apps/web-app/shared/seo.ts`. One URL of each public type was fetched. The sitemap had 116 URLs.

`@nuxtjs/seo` also prints a second `WebSite` and a `WebPage` on every page. The table below is the page graph from `headFromDocument`, plus the tags in the document head.

schema.org has no `Castle` type. Castle pages stay `TouristAttraction` plus `LandmarksOrHistoricalBuildings`. Emitting `Castle` would be an invalid type.

## Live site before this change

| Page type | Present | Missing |
| --- | --- | --- |
| Home | `lang=ru`. Title and description in range. Canonical. `og:*` and `twitter:card` `summary_large_image` on `/og-default.jpg` at 1200×630. `Organization` and `WebSite`. Hero photo is AVIF/WebP with width, height, and `fetchpriority=high`. | Organization logo. `BreadcrumbList` (the home page has no parent crumb, and the visible trail matches that). `robots` `max-image-preview:large`. `geo.region`. Preload of the hero image (only fonts were preloaded). |
| Place | Unique title and description. Canonical. OG and Twitter card. `BreadcrumbList`. Category type (`LandmarksOrHistoricalBuildings`, `Beach`, `Museum`, or `TouristAttraction`). Geo and locality address when the row has them. `ImageObject` with author and license. `FAQPage` when the body has «Частые вопросы». Gallery is AVIF/WebP with width and height. Cover is eager. Later photos are lazy. | `TouristAttraction` together with the specific type. `openingHours` even when the hours string is a clean daily range. `isAccessibleForFree` even when the price string is unambiguous. `max-image-preview:large`. `geo.region`. OG width and height were the master photo (for example 2560×1440) while `og:image` pointed at `og.jpg`. No hero preload. |
| Route index and route | Canonical, OG, Twitter, breadcrumbs. Index is `CollectionPage` plus `ItemList`. A route is `TouristTrip` with an `ItemList` itinerary and geo on a stop when the place has coordinates. `FAQPage` when the body has the FAQ section. | Short index title «Маршруты \| K39» (14 characters). `max-image-preview:large`. `geo.region`. Section index had no `lastmod`. |
| Collection index and collection | Same meta pattern as routes. `CollectionPage` plus `ItemList`. `FAQPage` when present. | Short index title «Подборки \| K39» (14). `max-image-preview:large`. `geo.region`. Section index had no `lastmod`. |
| Hub | Unique titles and descriptions on the live hubs. `CollectionPage`, `ItemList`, `BreadcrumbList`, `FAQPage`. Place cards are AVIF/WebP, width and height, lazy under the article. | `max-image-preview:large`. `geo.region`. Hub URLs had no `lastmod` even though `categories.updated_at` exists. |
| Quest index and quest | `TouristTrip` itinerary. `FAQPage` on the five-fort quest. Step photos are lazy. | Short index title «Квесты \| K39» (12). `max-image-preview:large`. `geo.region`. Quest index had no `lastmod`. |
| Venue | `BreadcrumbList`. `Restaurant` with geo, address, `priceRange`, `servesCuisine`, and `openingHoursSpecification` when those facts exist. Canonical, OG, Twitter, default 1200×630 image when the venue has no photo. | `CafeOrCoffeeShop` for `cafe` and `coffee` (every food kind was `Restaurant`). Title was only the name. `max-image-preview:large`. `geo.region`. Photos, when present, were all lazy, including the first. Venue images were not in the sitemap. |
| Venue listing | `CollectionPage` and `ItemList`. Breadcrumbs. Listings without a 300-character intro are `noindex` and stay out of the sitemap. | `max-image-preview:large`. `geo.region`. Index title «Заведения \| K39» is only the name. |
| Legal (`/about`, `/privacy`, `/terms`) | `lang=ru`. Unique titles. Canonical. OG and Twitter on the 1200×630 default. `BreadcrumbList`. | Terms description was 39 characters. `max-image-preview:large`. `geo.region`. No `updatedAt`, so `lastmod` stays omitted. |

Sitemap `lastmod` on places, routes, collections, quests, venues, and listing intros already came from `updated_at`. Place image entries were present (229 images). Fourteen URLs had no `lastmod`: the six hubs, four section indexes, and four legal or about URLs. Home used the newest content stamp.

## After this change

| Page type | Now present | Still omitted, on purpose |
| --- | --- | --- |
| Home | Organization logo (`/logo/moose-head-512.webp`, measured 576×512). `max-image-preview:large`. `geo.region` `RU-KGD`. Hero AVIF preload. | `BreadcrumbList`. There is no visible parent crumb. |
| Place | `@type` is `TouristAttraction` plus the category type. `openingHours` only for a full day range such as «Ежедневно 10:00-18:00». `isAccessibleForFree` only for an unambiguous price. Fallback title adds «часы и как добраться» when `seo_title` is empty and the result fits 15–70 characters. OG dimensions come from `og.jpg`. Hero preload. | Street address (places have no street column). Hours that are a note or a bare clock range. `Castle`. |
| Route, collection, hub, quest | Fallback titles use an intent phrase when `seo_title` is empty. Section indexes and hubs get `lastmod` from real `updated_at` values. | A stored `seo_title` is left as written. |
| Venue | `cafe` and `coffee` are `CafeOrCoffeeShop`. Other food kinds stay `Restaurant`. Hours, price, and cuisine stay conditional. First photo is eager and preloaded. Venue photos are image sitemap entries. Social image uses `og.jpg` dimensions. | `openingHours` text when no day has opens and closes. `creditText` and `copyrightNotice` are left for the other branch. |
| Venue listing | Same meta tokens as other public pages. `lastmod` still comes from the listing intro `updated_at` when the intro is long enough to index. | A filter without that intro stays `noindex` and out of the sitemap. |
| Legal | Terms description is long enough for the 50-character floor. `max-image-preview:large`. `geo.region`. | `lastmod`, because these pages are not rows with `updated_at`. |
