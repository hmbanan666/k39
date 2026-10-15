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

Hero, then the stored modules in stored order, then «Как внутри», «Как
добраться» (with `how-to-get` text), «Рядом посмотреть», «Источники».

## «Что заказать»

A short showcase of what the venue wants a visitor to notice. Not the menu. The official menu stays a link (`menuUrl`).

- At most 8 items. `venueModulesSchema` enforces it for the cabinet and for `venue_update`.
- `id` is stable. The server adds one when it is missing and keeps it when the item is edited or reordered. Guest reviews and guest photos will be venue-level. They do not attach to this id (ADR 0032).
- `description` is one short line. Older rows used `note` on the item; a write copies it into `description` and the public page reads either. The module `note` is the line under the cards.
- `priceRub` is optional. The page and the schema.org `Menu` hide a price whose `updatedAt` is older than 365 days, the same window as «Ориентиры цен». The stored number stays. Editing the name, the text, or the photo does not refresh the date. A new price, or the owner's «Подтвердить цену», does. A row with no date still shows the price.
- `mediaId` is an optional photo already attached to the venue. The cabinet uploads it with the rights checkbox; origin is `venue`, through the usual image pipeline, and it does not become the cover. An editorial write may newly attach only origin `own` or `commons`. An id that is already on the item is kept.
- Cards are server-rendered: photo or a plain fallback, name, price, short text. The same HTML is what a bot receives.
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

The public block is a grid of equal cards, one per catalog row. Every card
has the same slots:

- an icon in the audience-card style (dashed circle, amber fill) when the
  item has no picture. `price_items.image` wins when it is set, otherwise
  `PRICE_ITEM_IMAGES[slug]` in `apps/web-app/shared/price-compare.ts`. Without
  a custom picture, a slug in `FOOD_STICKERS` renders `<Sticker set="food">`
  at 56 CSS px (`sizes` matches). The card already prints the item name, so
  the sticker is `decorative` (empty alt). The dashed circle stays for the
  line icon only. That icon is `PRICE_ITEM_ICONS[slug]`, then
  `PRICE_CATEGORY_ICONS` (`coffee`, `bakery`, `dessert`, `breakfast`, `tea`,
  `drinks`, `beer`, `pizza`, `burger`, `street-food`, `sushi`, `salad`,
  `soup`, `pasta`, `main`, `fish`, `lunch`), then the ticket icon;
- the item name and its portion or volume;
- a large price;
- a comparison, computed on the server from `db.prices.forItem` (published
  venues, checked within a year, same region). One price per venue: the same
  portion when that venue has it, otherwise its cheapest fresh price. The
  card itself uses its own price.

With fewer than 3 venues the card says «пока мало данных для сравнения» and
draws no scale. Otherwise a three-part scale (дёшево, средне, дорого) marks
this price against the regional median: below 90% of the median is cheap,
above 110% is expensive, the rest is medium. The line under the scale is the
conclusion, for example «дешевле, чем в 7 из 10 мест Светлогорска». A price
in the expensive band and among the three highest, when at least four venues
are in the sample, says «топ-3 по цене в регионе».

A chip above the grid summarizes the cards, for example «Цены ниже среднего
по региону». It is omitted when no card has a comparison. Source and date
are small and muted. When every row shares one source, one footnote replaces
the repeated links.

Each card links to `/ceny/{slug}` or `/ceny/{slug}/{region}` (the catalog
slug and the region slug, for example `/ceny/cappuccino` and
`/ceny/cappuccino/svetlogorsk`). That page lists the venues with a fresh
price, cheapest first, using `VenueCard`, and is server-rendered. It stays
`noindex` and out of the sitemap until at least 5 venues are in the list.
`ceny` is a reserved place slug.

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
