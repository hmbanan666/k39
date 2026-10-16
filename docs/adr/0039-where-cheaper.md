# ADR 0039: «Где дешевле»

## Status

Accepted.

## Context

«Ориентиры цен» compares one venue with its town. A visitor who asks where a cappuccino is cheaper needs the town first, then the dish. ADR 0008 already reserved `/ceny/{item}` and `/ceny/{item}/{region}`. Those pages listed every fresh price, including owner rows, and they had no city index.

ADR 0033 stores a price as a fact beside `venue_prices`. The public reader for phone, address, coordinates, and status is `readShownFacts`. Price rows needed the same rule: use the fact when it is cited, otherwise the column.

`venues.phone` was copied through `cleanText(..., 40)` and the OSM import used the same cut. Three numbers do not fit. The fact schema allowed 80 characters, so a save could keep the full text in the fact and a truncated copy in the column. The next edit loaded the column and wrote the short text back over the fact.

## Decision

`/gde-deshevle` lists cities that have at least one comparable item. `/gde-deshevle/{region}` lists those items. `/ceny/{item}` and `/ceny/{item}/{region}` list the venues, cheapest first, with the portion, the median, the range, the check dates, and one menu link. The link is the URL used by the most prices on that page. A tie goes to the newer URL. The line ends with «Цены могли измениться».

A price counts when it is an official menu row: `sourceKind` official, a menu URL on the venue's site, checked within `PRICE_FRESH_DAYS`, on a published venue that is not operating closed. Owner prices stay on the venue card and are not peers. Packaged or bottled orange juice is not the catalog item. One price per venue: the cheapest remaining official variant.

The page is rendered from three venues (`PRICE_COMPARE_MIN`) and is indexable from five (`PRICE_INDEX_MIN`). A city is indexable from five venues that have any comparable price, even when no single item has five. Counts come from the rows. They are not a fixed list of towns.

When a price fact is cited, its value, source, and `checked_at` replace the column. A gap hides the price. A missing fact keeps the column.

The phone visitors see is the phone fact. `venues.phone` stores the same text, up to `PHONE_TEXT_MAX` (200). The fact schema uses that max. Postgres `varchar` has no length, so this is not a column migration. Editors, the cabinet, claims, and `venue_get` load the fact text so a later save does not replace it with a shorter column.

## Consequences

A town with fewer than three comparable prices for every item has no city page. Yantarny and Pionersky stay absent while they have no such prices. Adding a sixth venue can move a page from `noindex` into the sitemap without a code change.

An owner price no longer moves the town median. A social or map URL stored as official does not count as a menu.
