---
name: k39-venue-page
description: Use when building or editing a K39 venue page, including modules, the prices block, the passport, and internal links. Not for visual design of those blocks.
---

# K39 venue page

A venue page is `/zavedeniya/{slug}`. Module shapes, render order, and the price card are `docs/venue-modules.md`. Dish rows are ADR 0032. Claims and owner edits are ADR 0031. Copy is `k39-writing`. Facts are `k39-sources-and-facts`. Prices are `k39-price-anchors`.

Supply data. Do not restyle a block and do not pick its sticker.

## Order

The hero is first: photo, title, short text, tag pills. On a wide screen «Коротко» sits beside the article from the top. Both are system blocks. They are not entries in `venues.modules`.

The main column then renders, via `presentVenueBlocks`:

1. «Ориентиры цен» (`prices`)
2. «Что заказать» (`dishes`)
3. The other stored modules, in the order they were saved

Stored order stays as the editor wrote it. Do not move `prices` to the top of the JSON to change the page.

A venue that sells entry or hosts dated events (a concert hall, a museum café) takes ticket rows with `admission_set` and events with `event_upsert` (ADR 0046). «Коротко» then shows «Билеты» and the page shows «Ближайшее». Sources follow `k39-sources-and-facts`. These are not modules and not menu prices. Do not retell them in the description.

A relocation is a notice (`notices_set`, ADR 0049) with the temporary address as text. Do not edit the stored address or the map pin.

After that the page adds «Ближайшее» (upcoming events), «Как внутри», «Как добраться» (the `how-to-get` text plus the map), «Рядом посмотреть», «Источники», and the owner note. Each one hides without data.

## Modules

`venue_update.modules` replaces the list and is checked with `venueModulesSchema`. Include `{ type: 'prices' }` on every venue you prepare. The block hides until fresh `venue_prices` exist. Still send the module.

Add `dishes`, `text`, `audience`, `practical`, `best-time`, `how-to-get`, `tips`, or `faq` only when you have the facts. An empty list falls back to `description` as «О месте». At most one of each unique type. `dishes` is at most 8 (`DISH_SHOWCASE_MAX`). `description` stays 300–600 characters to publish, and remains the meta and JSON-LD source.

`how-to-get` text is shown inside «Как добраться», including when there are no coordinates.

## Stickers

Block components own stickers. There is no sticker field in the module JSON.

- `audience` shows `with-heart`. `how-to-get` shows `with-map`.
- A dish with no photo shows `cook-with-pan` in the 56×56 box.
- A price row uses `price_items.image`, otherwise `<Sticker set="food">` (`docs/food-stickers.md`).
- The hero sticker is the component's fallback when there is no photo.

Do not put a sticker slug in module text. Moose rules are `docs/stickers.md`. A module sticker is outside the two-per-page moose cap.

## Passport and links

Set the passport with `page_passport_set` for `pageType: venue` or path `/zavedeniya/{slug}`: `targetQueries`, `audience`, `primaryAction`, `goal30d`, `goal90d`. An empty passport fails the score (`passport empty`, ADR 0016). Personas (ADR 0024) do not replace it.

The page links `/zavedeniya`, the town listing when `regionSlug` is set, and the nearest places when coordinates are set (`contentLinks` in `shared/scoring.ts`). «Рядом посмотреть» is that place list. Set the region and the coordinates. Do not invent a place slug in the description. A markdown link must be a published K39 path.

Status, slug, and SEO stay editorial. Set `lastVerifiedAt` when you check the facts. A venue is stale after 180 days and leaves «Где поесть рядом» after 365.

## Page chrome

The price-band badge sits to the right of the «Ориентиры цен» title (`price-badge` in `VenueModules.vue`). From 720px it shares the heading row. Below that it wraps. Visible text is «ниже среднего», «выше среднего», or «около среднего». It is hidden when `price_band` is null. Do not type the badge into the description. The scale math is `docs/venue-modules.md`.

«Источники» is a collapsed `<details>` whose summary is «Источники» (`VenuePage.vue`, the same pattern as the place page). Put each source in `sources`. Do not paste the list into the description.

Photos: Commons or our own shots. `permission` and origin `venue` are cabinet owner uploads only (`k39-sources-and-facts`).

## Examples

Good description:

> Кафе на улице Октябрьской, 10. Кухня с 9:00 до 21:00. Летом сажают на террасе во дворе.

Bad description (price retelling and template phrases):

> Уютное кафе в самом сердце Светлогорска. Капучино 250 ₽, сырники 320 ₽. Сок только свежевыжатый, не из пакета. Цены могли измениться. Отличный выбор для ценителей.

Good modules, prices filled separately with `venue_prices_set`:

```text
[
  { type: 'prices' },
  { type: 'dishes', items: [{ name: 'Клопсы', description: 'В белом соусе', priceRub: 540 }] },
  { type: 'how-to-get', text: 'Остановка «Вокзал», 4 минуты пешком.' }
]
```

Bad: `{ type: 'audience', items: [{ who: 'Все', text: 'Уютная атмосфера, каждый найдёт своё.' }] }` with no sourced fact, and a sticker slug stuffed into `text`.

Bad: omitting `{ type: 'prices' }` because the menu is not collected yet. Include the module and leave `venue_prices` empty until the menu is official.

## Checklist

- `{ type: 'prices' }` is in `modules`. Other modules have sourced facts only.
- `description` is 300–600 characters. `lastVerifiedAt` is the check day.
- No sticker slugs in the JSON. Dish and price pictures follow the docs.
- Passport has queries, audience, action, and both goals.
- Region and coordinates are set when known, so the town listing and nearby places link.
- Address, hours, phone, operating status, and coordinates follow `k39-sources-and-facts`: official site, then Yandex Maps, 2GIS, and OSM for a fact the site does not state, then «уточняйте». A map card is `{ title, url }` in `sources`. Menu lines and prices stay the official menu. No text, description, photo, review, rating, or average check comes from a map.
- The description does not retell prices or disclaim the price block. Photos follow the photo policy.
- Publish only after the reviewer pass in `k39-publish-review`. The author does not publish.
