# Venue page modules

A venue page (`/zavedeniya/{slug}`) is built from content modules, the same
idea as module pages (ADR 0023). Editors store an ordered list in
`venues.modules` (jsonb) through the content MCP (`venue_update.modules`,
`venue_get` returns it). The schema lives in `apps/web-app/shared/venue-modules.ts`.

Rules:

- Every module renders only when it has data. An empty or invalid list falls
  back to the plain `description` as «О месте».
- Text is ours and original. Facts (hours, address, takeaway, prices) come from
  OSM, the venue's own site or socials, or our visit. Nothing is copied from
  aggregators or other guides. No ratings.
- `description` stays as the archive and the source for the meta description
  and JSON-LD.

## Stored content modules (editor writes them)

| type | Title on page | Shape | Notes |
| --- | --- | --- | --- |
| `text` | «О месте» or own title | `{ title?, variant: lead\|plain, text }` | Same shape as ADR 0023 `text`. |
| `dishes` | «Что заказать» | `{ title?, items: [{ name, priceRub?, note? }], note? }` | Up to 8. Falls back to `signatureDishes`. Price only when seen on the official menu. |
| `audience` | «Кому подойдёт» | `{ title?, items: [{ who, icon?, text }] }` | 2 to 5 short cards. `icon` is one of `AUDIENCE_ICONS` (group, family, kids, couple, solo, friends, beach, day-trip, tourist, local, pets, work), default `group`. The heading gets the `with-heart` sticker when the hero has photos (no hero sticker). |
| `practical` | «Полезно знать» | `{ title?, items: [{ key, label, value }] }` | Only known facts: takeaway, terrace, kids, payment, wifi, dogs, parking, other. |
| `best-time` | «Когда лучше прийти» | `{ title?, text }` | Only with real data (hours, queues seen, season). |
| `how-to-get` | in «Как добраться» | `{ text }` | Shown above the map. When the hero has photos, that heading gets the `with-map` sticker (same size and placement as `with-heart`). Both stickers show together: the headings are far apart. |
| `prices` | «Ориентиры цен» | `{ title? }` | Rows come from `venue_prices` (see below), not from the module. Hidden without fresh verified prices. |
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

## «Ориентиры цен» and the shared price catalog

No full menus. A venue shows a few familiar benchmark items with prices so
visitors can compare venues.

- `price_items` is the shared catalog: `slug`, `title`, `category`,
  `default_variant`, `sort_order`. Seeded with капучино, американо, пицца
  «Маргарита», ролл «Филадельфия», борщ, бургер. Edit with
  `price_items_list` and `price_item_upsert`.
- `venue_prices` holds one row per venue, item and variant: `price_rub`,
  `checked_at`, `source_kind` (`official` with a URL to the venue's own menu,
  site or socials, or `owner`), `source_title`, `source_url`. Set with
  `venue_prices_set` (replaces the list); `venue_get` returns them.
- Prices are never invented or taken from aggregators. Rows older than 365
  days are not shown. Without fresh rows the module is hidden.
- The catalog is shared so prices compare across venues; `db.prices.forItem`
  lists one item across published venues, cheapest first, as the base for
  collections like «Топ капучино области».

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
the same check as `venue_update.modules`. «Ориентиры цен» is `venue_prices`
with `sourceKind: owner`, the same object as `venue_prices_set`. The server
forces that source and does not let the owner edit `price_items`. The public
card links to the claim instead of a mailto.
