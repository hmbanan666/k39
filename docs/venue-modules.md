# Venue page modules

A venue page (`/zavedeniya/{slug}`) is built from content modules, the same
idea as module pages (ADR 0023). Editors store an ordered list in
`venues.modules` (jsonb) through the content MCP (`venue_update.modules`,
`venue_get` returns it). The schema lives in `apps/web-app/shared/venue-modules.ts`.

A collection module page stores the article in `collections.modules`. A save
derives `body` from that prose, rejects a different `body`, and returns
`renderedFields`. The modules are the article. Do not keep a second article
in `body`.

The owner cabinet and `venue_update` both validate `venues.modules` with
`venueModulesSchema`. Prices use the same object as `venue_prices_set`. The
cabinet forces `sourceKind` to `owner`. Do not invent a parallel shape.

Rules:

- Every module renders only when it has data. An empty or invalid list falls
  back to the plain `description` as «О месте».
- A sticker is part of the module component. `audience` shows `with-heart` and
  `how-to-get` shows `with-map` whenever that module renders. Photos,
  coordinates, and other stickers on the page do not hide them. The hero
  sticker and the owner card stay as they are.
- Text is ours and original. For a venue that really exists and operates,
  hours, phone, address, operating status, and coordinates come from the
  official site, then Yandex Maps, 2GIS, or OSM when the site does not state
  them. Prices come from the official menu. Nothing is copied from map cards,
  aggregators, or other guides: no texts, descriptions, photos, reviews,
  ratings, or an average check. No ratings.
- `description` stays as the archive and the source for the meta description
  and JSON-LD.

## Stored content modules (editor writes them)

| type | Title on page | Shape | Notes |
| --- | --- | --- | --- |
| `text` | «О месте» or own title | `{ title?, variant: lead\|plain, text }` | Same shape as ADR 0023 `text`. |
| `dishes` | «Что заказать» | `{ title?, items: [{ id, name, description?, priceRub?, mediaId?, updatedAt }], note? }` | Showcase of at most 8, not a menu. See below. Falls back to `signatureDishes` when this module is absent. |
| `audience` | «Кому подойдёт» | `{ title?, items: [{ who, icon?, text }] }` | 2 to 5 short cards. `icon` is one of `AUDIENCE_ICONS` (group, family, kids, couple, solo, friends, beach, day-trip, tourist, local, pets, work), default `group`. The heading shows the `with-heart` sticker. |
| `practical` | «Полезно знать» | `{ title?, items: [{ key, label, value }] }` | Only known facts: takeaway, terrace, kids, payment, wifi, dogs, parking, other. |
| `best-time` | «Когда лучше прийти» | `{ title?, text }` | Only with real data (hours, queues seen, season). |
| `how-to-get` | in «Как добраться» | `{ text }` | Shown above the map, including when the venue has no coordinates. The heading shows the `with-map` sticker. |
| `prices` | «Ориентиры цен» | `{ title? }` | Cards come from `venue_prices` (see below), not from the module. Hidden without fresh verified prices. |
| `tips` | «Советы» | `{ title?, items: [text] }` | Short practical tips. |
| `faq` | «Вопросы» | `{ title?, items: [{ question, answer }] }` | Answers from known facts only. |

## System modules (built from fields, not stored)

| Block | Source | Shown when |
| --- | --- | --- |
| Hero bento | venue photos | always (sticker without photos) |
| «Коротко» | hours, price, address, phone, actions | always; «Маршрут» whenever there are coordinates |
| «Как внутри» | photos not in the hero | there are such photos |
| «Как добраться» map | coordinates | coordinates set |
| «Рядом посмотреть» | nearest places within 3 km; farther ones as one line | any place found |
| «Источники» | `sources` | at least one source |
| Owner note | link to `/kabinet/zayavka/{slug}` | always |

## Order on the page

The hero stays first: the photo, the title, the short text, and the tag pills.

The hero stays above the article. Under it, the reader is the same two
columns as on other pages: the main column, and «Коротко» beside it from
the top on a wide screen.

Inside the main column the page renders «Ориентиры цен», then «Что заказать»,
then the other stored modules in the order they were saved. That order is
only the render. `venues.modules` stays as the editor wrote it, so a later
edit does not have to move the prices module to the top.

Then «Как внутри», «Как добраться» (with `how-to-get` text), «Рядом
посмотреть» and «Источники» sit under the two columns and use the full
frame, so the map and the nearby cards are not stuck in the article measure.
«Источники» is a collapsed `<details>` whose summary is the heading.
When the how-to-get text already contains the street address, the page does
not print that address again above it. A menu link with no dishes does not
open an empty «Что заказать» section: the menu stays on the «Коротко» button.

## «Что заказать»

A short showcase of what the venue wants a visitor to notice. Not the menu. The official menu stays a link (`menuUrl`).

- At most 8 items. `venueModulesSchema` enforces it for the cabinet and for `venue_update`.
- `id` is stable. The server adds one when it is missing and keeps it when the item is edited or reordered. Guest reviews and guest photos will be venue-level. They do not attach to this id (ADR 0032).
- `description` is one short line. Older rows used `note` on the item; a write copies it into `description` and the public page reads either. The module `note` is the line under the cards.
- `priceRub` is optional. The page and the schema.org `Menu` hide a price whose `updatedAt` is older than 365 days, the same window as «Ориентиры цен». The stored number stays. Editing the name, the text, or the photo does not refresh the date. A new price, or the owner's «Подтвердить цену», does. A row with no date still shows the price.
- `mediaId` is an optional photo already attached to the venue. The cabinet uploads it with the rights checkbox; origin is `venue`, through the usual image pipeline, and it does not become the cover. An editorial write may newly attach only origin `own` or `commons`. An id that is already on the item is kept.
- Rows are server-rendered and the same size as a price row: a fixed 56×56 px thumbnail, the name, and the price. A missing photo keeps that box and shows the `cook-with-pan` sticker. The short text and the photo credit stay in the HTML and show on hover, focus, and tap. The same HTML is what a bot receives.
- Migration `0029_dish_showcase` fills `id`, `description` (from `note`), and `updatedAt` on existing items and does not drop `note` or `signature_dishes`. `updatedAt` is the migration time, so a price that is visible today stays visible.

## «Ориентиры цен» and the shared price catalog

No full menus. A venue shows a few familiar benchmark items so a visitor can
tell, in one glance, whether this place is cheap or expensive.

- `price_items` is the shared catalog: `slug`, `title`, `category`,
  `default_variant`, `sort_order`, and an optional `image`. The live catalog
  includes latte, raf, espresso, pepperoni, carbonara, shawarma, pelmeni,
  bliny, tom-yum, ramen, salmon-steak, draniki, klopsy, mors, lemonade,
  mulled-wine, croissant, cheesecake, syrniki, tea-lemon, orange-juice, beer,
  margherita, burger, philadelphia, caesar, borscht, ukha, smoked-fish,
  business-lunch, americano, and cappuccino. Edit with `price_items_list` and
  `price_item_upsert`. `image` is a site path or an https URL. Null clears it.
  Omitting it on an update keeps the stored picture.
- `venue_prices` holds one row per venue, item and variant: `price_rub`,
  `checked_at`, `source_kind` (`official` with a URL to the venue's own menu,
  or `owner`), `source_title`, `source_url`. The menu URL is a page or PDF on
  the venue site, or a document on `drive.google.com`, `docs.google.com`,
  `disk.yandex.*`, or `yadi.sk`. VK uses one rule: the fact source kind is
  `official_social` and the host is `vk.com` or `vk.ru`. This column stays
  `official` because it cannot store `official_social`. Comparison treats
  that column, before the fact overlay, as the same claim. It counts only
  when `venues.website` is empty and the price community matches a VK link
  in `socials`: the same screen name, or the same numeric id from `club`,
  `public`, `event`, `wall-`, `market-`, `album-`, `photo-`, `doc-`,
  `topic-`, or `video-`. A `w=` or `z=` object is that owner, and the path
  screen name is ignored. A section path such as `feed` is not a screen name.
  `website` is only the venue's own site. A social host is rejected there
  and belongs in `socials`.
  Other social networks are not a menu. Set with `venue_prices_set` (replaces
  the list); `venue_get` returns them.
- Prices are never invented or taken from aggregators. Rows older than 365
  days are not shown. Without fresh rows the module is hidden.

The public block is a compact price list, two columns from 720px and one
column below that. Every card is the same row: a 56×56 px picture box, the
name and portion, then a large price. The picture is `price_items.image` when
that is set, otherwise `<Sticker set="food">` when the slug is in
`FOOD_STICKERS`, otherwise a line icon. The sticker is `decorative` because
the card already prints the name. The box is a fixed square with
`object-fit: contain` and `overflow: hidden`. Trimmed food stickers do not
share an aspect ratio (a beer glass is much taller than a plate), so the card
sizes the box, not the file width. A width-sized sticker overflows and covers
the title. The line icon is `PRICE_ITEM_ICONS[slug]`, then
`PRICE_CATEGORY_ICONS` (`coffee`, `bakery`, `dessert`, `breakfast`, `tea`,
`drinks`, `beer`, `pizza`, `burger`, `street-food`, `sushi`, `salad`,
`soup`, `pasta`, `main`, `fish`, `lunch`), then the ticket icon.
`PRICE_ITEM_IMAGES[slug]` is the code fallback when the catalog row has no
picture.

Under the heading, one line says what the block is, for example «Сравниваем
с другими заведениями Светлогорска». The town is the genitive from the venue.
Without a known town it says «региона».

The comparison is computed on the server from `db.prices.forItem`, then the
price fact when that row is cited (ADR 0033). Published venues only (drafts,
closed and archived are out), checked within a year, in the same region.
Peers are official menu rows: `sourceKind` official and a menu URL (the
venue site, or a document on Drive, Google Docs, or Yandex Disk), or the
venue's own VK page when `website` is empty and the community matches a
VK link in `socials`. An owner price stays on this card and is not a peer. Packaged or bottled
orange juice is not the catalog row. One price per venue: the
same portion when that venue has it, otherwise its cheapest fresh official
price. The card uses its own price. `/ceny` and `/gde-deshevle` use that
sample. A listing is omitted below three venues (`PRICE_COMPARE_MIN`) and
stays `noindex` and out of the sitemap below five (`PRICE_INDEX_MIN`).

The row that is visible at rest is the picture, the name, the portion, the
price, and the comparison scale. The detail sits in the HTML and opens as a
popup on hover and keyboard focus, and on the first tap when the pointer is
coarse. A second tap follows the card link. The popup is tied to the card
with `aria-describedby`. It fades and scales in over about 150ms, and skips
that motion when the visitor asks for less. It is anchored just under the
card, so the price on the card stays visible.

The popup reads, top to bottom: one verdict («Дешевле, чем в 4 из 5 мест
Светлогорска», «Как в других местах Светлогорска», «Пока единственная цена»,
or «Пока мало данных для сравнения»), then the town figures under a heading
such as «В Светлогорске» («Медиана: 300 ₽», «Диапазон: 185–420 ₽», «Мест: 5»),
then «В этом заведении» and «Порция: …» when the portion is known. A
placeholder such as «объём не указан» is not a portion.

- One venue in the region: verdict «Пока единственная цена». A neutral bar
  of the same weight as the scale, with no mark. The popup still lists that
  one price as the median and the range, and «Мест: 1».
- Two venues: verdict «Пока мало данных для сравнения». The same neutral bar.
  The popup lists the real median and range.
- Three or more: a three-part scale (cheaper, typical, dearer) marks this
  price against the median of that town (below 90% is cheap, above 110% is
  expensive). The accessible
  name of the bar uses the dative, for example «Дешевле медианы по
  Светлогорску». The verdict is «Дешевле, чем в 7 из 10 мест Светлогорска»
  or the dearer form. After «из», 21, 31… take «места» and every other count
  takes «мест». A price in the expensive band and among the three highest,
  when at least four venues are in the sample, says «Топ-3 по цене в
  Светлогорске». An unknown town stays «в регионе».

The badge sits on the same row as the heading and wraps under the heading
when the row is narrow. The visible text is
«ниже среднего», «выше среднего», or «около среднего». The full phrase, for
example «Цены ниже среднего по Светлогорску», is the badge `title` and
`aria-label`. The town is already in the line under the heading. The badge
is omitted when the stored band is null.

The band is stored on the venue, not computed while the page renders.
`price_band` is `low`, `mid`, or `high` (ниже, около, выше). It is not the
editorial `price_level` of 1–4. `price_band_basis` is how many of this
venue's prices had a town comparison. `price_band_computed_at` is when that
row was written. The sample is the same as the cards: published venues in
the town, one fresh price each. A single price is compared only when that
town sample has at least three venues. The venue band itself stays null
until at least `PRICE_BAND_MIN` (3) of this venue's prices have such a
comparison. Below that, `price_band` is null and the header badge is hidden.
The basis is still stored. Saving
prices, publishing or unpublishing, or moving a venue to another town
recomputes every venue in the affected town, because one price changes the
others. `venue_price_bands_recompute` does that for one town on demand.
`venue_get` and `venues_list` return the three fields. There is no public
filter yet.

One line sits under the whole grid, for example «Меню на сайте заведения,
15 октября 2026 г. Цены могли измениться.» It names a single source: the URL
used by the most prices. A tie goes to the URL whose newest price is later.
The date is the latest day among the prices that use that URL. A row with no
URL is used only when no price has a URL, and then the line is plain text.
Each card still carries `sourceTitle`, `sourceUrl`, and `checkedAt` for the
schema.org `ItemList` of `Offer`s. Those per-price sources are not repeated
under the grid.

The whole card is one link to `/ceny/{slug}/{region}?from={venueSlug}` (or
`/ceny/{slug}?from=` when the venue has no region), for example
`/ceny/cappuccino/svetlogorsk?from=bochka-pab`. The listing title is
«Капучино в Светлогорске». Venues are cheapest first, each with its portion.
The page shows the median, the range, and when the prices were checked.
One source line under the list names the menu URL used by the most prices
on that page, then the latest day among those prices, then «Цены могли
измениться». `?from=` highlights that venue with «Это заведение» and is
server-rendered. The clean URL stays the canonical. A query other than
paging or a tracking parameter is `noindex`, so the highlighted URL is not
a second indexable page. The page is not rendered below 3 comparable
venues. It stays `noindex` and out of the sitemap until at least 5 are in
the list. `ceny` is a reserved place slug.

`/gde-deshevle` lists cities that have at least one such item.
`/gde-deshevle/{region}` lists those items with the median, the range, and
the number of places. A city page is indexable when the city has at least
5 venues with a fresh official menu price, including venues whose item does
not yet have three prices. ADR 0039.

## Listing modules

A town or kind listing (`/zavedeniya`, `/zavedeniya/{region}`, `/zavedeniya/{kind}`, `/zavedeniya/{region}/{kind}`) can carry its own modules in `venue_listing_intros.modules`. `venue_listing_modules_set` replaces that list. It does not change the intro. An empty array clears the modules. The intro of at least 300 characters is still what makes a filter URL indexable.

Each block is optional and renders only when it has data. Invalid JSON renders nothing, and the card grid stays. «Как выбрать» and «По ситуации» sit above the grid. «Районы и улицы», «Сезонность» and «Вопросы» sit below it. «Вопросы» adds FAQPage when the page is indexable. «По ситуации» links to published venues and reuses `VenueCard`. A missing venue is left out of that block.

| type | Title on page | Shape |
| --- | --- | --- |
| `choose` | «Как выбрать» | `{ title?, text }` markdown |
| `situation` | «По ситуации» | `{ title?, items: [{ label, note?, placeSlug, icon? }] }` up to 8. `icon` is `kids`, `beaches`, `hours`, `coffee`, `family`, or `group`. `placeSlug` must be a published venue. |
| `areas` | «Районы и улицы» | `{ title?, items: [{ name, text }] }` up to 8 |
| `season` | «Сезонность» | `{ title?, text?, items?: [{ when, text }] }`. Needs `text` or at least one item. |
| `faq` | «Вопросы» | `{ title?, items: [{ question, answer }] }` up to 8 |

At most one module of each type. Do not invent the copy here: the tool only stores what an editor sends.

## Owner cabinet (ADR 0031)

A verified owner edits `venues.modules` in `/kabinet` with `venueModulesSchema`,
the same check as `venue_update.modules`. «Что заказать» is that module: add,
edit, reorder, remove, change the price, and upload a photo with the rights
checkbox (at most 8, counter «5 из 8»). «Ориентиры цен» is `venue_prices`
with `sourceKind: owner`, the same object as `venue_prices_set`. The server
forces that source and does not let the owner edit `price_items`. The public
card links to the claim instead of a mailto.
