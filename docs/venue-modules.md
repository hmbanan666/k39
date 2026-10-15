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
| `audience` | «Кому подойдёт» | `{ title?, items: [{ who, icon?, text }] }` | 2 to 5 short cards. `icon` is one of `AUDIENCE_ICONS` (group, family, kids, couple, solo, friends, beach, day-trip, tourist, local, pets, work), default `group`. The heading gets the `with-heart` sticker only when the hero has photos (no hero sticker), so the page keeps at most two stickers. |
| `practical` | «Полезно знать» | `{ title?, items: [{ key, label, value }] }` | Only known facts: takeaway, terrace, kids, payment, wifi, dogs, parking, other. |
| `best-time` | «Когда лучше прийти» | `{ title?, text }` | Only with real data (hours, queues seen, season). |
| `how-to-get` | in «Как добраться» | `{ text }` | Shown above the map. |
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
| Owner note | mailto until the owner cabinet exists | always |

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
