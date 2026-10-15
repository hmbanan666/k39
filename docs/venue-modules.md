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
| `audience` | «Кому подойдёт» | `{ title?, items: [{ who, text }] }` | 2 to 5 short cards. |
| `practical` | «Практично» | `{ title?, items: [{ key, label, value }] }` | Only known facts: takeaway, terrace, kids, payment, wifi, dogs, parking, other. |
| `best-time` | «Когда лучше прийти» | `{ title?, text }` | Only with real data (hours, queues seen, season). |
| `how-to-get` | in «Как добраться» | `{ text }` | Shown above the map. |
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
