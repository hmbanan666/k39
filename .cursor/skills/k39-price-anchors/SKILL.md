---
name: k39-price-anchors
description: Use when setting «Ориентиры цен» or matching a menu line to the K39 price catalog. Covers the 32 items, variants, official menus, the 12-price cap, and band thresholds.
---

# K39 price anchors

«Ориентиры цен» is a few familiar dishes so a visitor can see if the place is cheap or expensive. It is not a menu. The official menu stays `menuUrl`. Card layout, verdicts, and the badge are `docs/venue-modules.md` and `apps/web-app/shared/price-compare.ts`. Pictures are `docs/food-stickers.md`. Do not restate them.

Write with `venue_prices_set`. Rows are `venuePricesWriteSchema` in `apps/web-app/server/utils/venues/prices.ts`. Read the live titles with `price_items_list`. The card title is `price_items.title`, not the sticker name.

## Catalog

32 slugs, the same set as `FOOD_STICKERS` and `PRICE_ITEM_ICONS`. Names and pictures: `docs/food-stickers.md`. Do not price a slug that `price_items_list` does not return.

Coffee: `americano`, `cappuccino`, `espresso`, `latte`, `raf`.

Drinks: `beer`, `lemonade`, `mors`, `mulled-wine`, `orange-juice`, `tea-lemon`.

Breakfast: `bliny`, `croissant`, `syrniki`.

Mains and local: `burger`, `carbonara`, `draniki`, `klopsy`, `pelmeni`, `salmon-steak`, `shawarma`, `smoked-fish`.

Pizza: `margherita`, `pepperoni`.

Soups: `borscht`, `ramen`, `tom-yum`, `ukha`.

Other: `business-lunch`, `caesar`, `cheesecake`, `philadelphia`.

## Matching

Match the standard dish, not a house special that only shares a word. Put the menu's size or allowed variant in `variant` (max 40 characters). Omit `variant` to store `price_items.default_variant` (seed examples: cappuccino `300 мл`, margherita `30 см`, philadelphia `8 шт.`). One row per item and variant.

- `caesar`: any chicken or kebab (шашлык) Caesar. Variant carries the protein («с курицей», «с шашлыком»). A shrimp or tofu Caesar is a different dish. Skip it.
- `tea-lemon`: any tea the venue serves. Variant names the kind («чёрный», «зелёный»). A lemon slice is not required.
- `orange-juice`: only juice the venue serves, fresh or poured by the glass.
- Never packaged or bottled: a fridge bottle, a can, or a branded retail drink (a shop juice, a canned soda, a sealed water). Skip the row. This applies to every catalog drink, not only juice.

## Source

Editorial rows are `sourceKind: official` and need `sourceUrl` on the venue's own menu, site, or official social post. `sourceTitle` is a short label such as «Меню на сайте заведения». `checkedAt` is the day you read that page (`YYYY-MM-DD`). The repository rejects an official row with no URL.

Do not use Yandex, 2GIS, aggregators, or delivery apps (`k39-sources-and-facts`). Do not invent a price from neighbouring venues.

`sourceKind: owner` is the cabinet. The server forces it and drops `sourceUrl` (ADR 0031). An editor agent does not send `owner`.

At most 12 prices per venue. A longer list fails the write. Prices older than 365 days stay stored and are hidden.

## Thresholds

Constants in `shared/price-compare.ts`. Do not change a badge by hand. `venue_update` does not accept `price_band`.

| Constant | Value | Effect |
| --- | --- | --- |
| `PRICE_COMPARE_MIN` | 3 | Colored scale needs this many published venues in the town sample. Below that the verdict is «Пока единственная цена» or «Пока мало данных для сравнения». |
| `PRICE_INDEX_MIN` | 5 | `/ceny/{slug}/{region}` stays `noindex` until this many published venues have a fresh price. Drafts do not count. |
| `PRICE_BAND_MIN` | 3 | The venue badge stays hidden until at least 3 of this venue's prices each have a town sample of 3 or more. `price_band` is null below that. `price_band_basis` is still stored. |

`venue_prices_set` recomputes every venue in that town and returns `priceBands`. Publishing, unpublishing, or moving a venue to another town recomputes the affected towns. After a change that did not go through `venue_prices_set`, call `venue_price_bands_recompute` with the town `regionSlug`.

The band is `low`, `mid`, or `high`. It is not the editorial `price_level` of 1 to 4.

## Examples

Menu: «Цезарь с курицей 490 ₽», read on the venue site on 15 Oct 2026.

Good:

```text
{ item: 'caesar', variant: 'с курицей', priceRub: 490, checkedAt: '2026-10-15', sourceKind: 'official', sourceTitle: 'Меню на сайте заведения', sourceUrl: 'https://cafe.example/menu' }
```

Bad: the same 490 ₽ with `sourceUrl` on a Yandex or 2GIS page.

Bad: `{ item: 'orange-juice', variant: 'Добрый 0,2', priceRub: 150 }` for a bottled juice in the fridge.

Bad: a thirteenth row, or a price you filled in because other cafes in town charge about that.

## Checklist

- The slug is one of the 32, and `price_items_list` has it.
- Caesar, tea, and juice follow the matching rules. Packaged and bottled drinks are omitted.
- `variant` is the menu text, or omitted for the catalog default.
- Official URL, title, and `checkedAt` are set. The price was not guessed.
- The venue has at most 12 rows.
- The town was recomputed. A null band with basis under 3 is left null.
