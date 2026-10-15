# Venue page modules

A venue page (`/zavedeniya/{slug}`) is built from content modules, the same
idea as module pages (ADR 0023). Editors store an ordered list in
`venues.modules` (jsonb) through the content MCP (`venue_update.modules`,
`venue_get` returns it). The schema lives in `apps/web-app/shared/venue-modules.ts`.

Rules:

- Every module renders only when it has data. An empty or invalid list falls
  back to the plain `description` as «О месте».
- A sticker is part of the module component. `audience` shows `with-heart` and
  `how-to-get` shows `with-map` whenever that module renders. Photos,
  coordinates, and other stickers on the page do not hide them. The hero
  sticker and the owner card stay as they are.
- Text is ours and original. Facts (hours, address, takeaway, prices) come from
  OSM, the venue's own site or socials, or our visit. Nothing is copied from
  aggregators or other guides. No ratings.
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

Directly under the hero the page renders «Ориентиры цен», then «Что заказать»,
then the other stored modules in the order they were saved. That order is
only the render. `venues.modules` stays as the editor wrote it, so a later
edit does not have to move the prices module to the top.

Then «Как внутри», «Как добраться» (with `how-to-get` text), «Рядом
посмотреть», «Источники». On a wide screen «Коротко» stays beside the
article, under the price list and the showcase.

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
  site or socials, or `owner`), `source_title`, `source_url`. Set with
  `venue_prices_set` (replaces the list); `venue_get` returns them.
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

The comparison is computed on the server from `db.prices.forItem`. That query
keeps published venues only (drafts, closed and archived are out), checked
within a year, in the same region. One price per venue: the same portion when
that venue has it, otherwise its cheapest fresh price. The card uses its own
price. The same published count is what `/ceny` uses for `noindex` and the
sitemap (`PRICE_INDEX_MIN`, five venues).

The row that is visible at rest is the picture, the name, the portion, the
price, and the comparison scale. The sentence and the words дёшево / средне /
дорого are not in that row. They sit in the HTML and show as a tooltip on
hover and keyboard focus, and on the first tap when the pointer is coarse.
A second tap follows the card link. The tooltip is tied to the card with
`aria-describedby`.

- One venue in the region: «пока единственная цена в Светлогорске». A short
  neutral bar, not the colored scale. The town is prepositional. The sentence
  is in the tooltip.
- Two venues: the real range, for example «в Светлогорске 180–220 ₽ (2 места)».
  The parenthetical uses the nominative plural («1 место», «2 места», «5 мест»).
  The same neutral bar. The sentence is in the tooltip.
- Three or more: a small scale marks this price against the median of that
  town (below 90% is cheap, above 110% is expensive). The bar is colored.
  The labels дёшево / средне / дорого are in the tooltip, and the active one
  is marked. The accessible name of the bar uses the dative, for example
  «Дешевле медианы по Светлогорску». The sentence is «дешевле, чем в 7 из 10
  мест Светлогорска» or the dearer form. After «из», 21, 31… take «места»
  and every other count takes «мест». A price in the expensive band and among
  the three highest, when at least four venues are in the sample, says
  «топ-3 по цене в Светлогорске». An unknown town stays «в регионе».

A small badge sits to the right of the heading and the comparison line, on
the same row from 720px and on the next line below that. The visible text is
«ниже среднего», «выше среднего», or «около среднего». The full phrase, for
example «Цены ниже среднего по Светлогорску», is the badge `title` and
`aria-label`. The town is already in the line under the heading. The badge
is omitted when no card has a comparison.

One line sits under the whole grid, for example «Меню на сайте заведения,
15 октября 2026 г. Цены могли измениться.» It lists each distinct menu link
(the same title and URL once), then the check date, then that sentence.
When the dates differ it says «проверено с … по …», from the earliest day
to the latest, and the same sentence follows. A row with no URL is plain
text in that same line. The line is server-rendered. Each card still carries
`sourceTitle`, `sourceUrl`, and `checkedAt`, and the page adds a schema.org
`ItemList` of `Offer`s with that source.

The whole card is one link to `/ceny/{slug}/{region}?from={venueSlug}` (or
`/ceny/{slug}?from=` when the venue has no region), for example
`/ceny/cappuccino/svetlogorsk?from=bochka-pab`. The listing title is
«Капучино в Светлогорске». Venues are cheapest first. `?from=` highlights
that venue with «Это заведение» and is server-rendered. The clean URL stays
the canonical. A query other than paging or a tracking parameter is `noindex`,
so the highlighted URL is not a second indexable page. The listing stays
`noindex` and out of the sitemap until at least 5 published venues are in
the list. `ceny` is a reserved place slug.

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
