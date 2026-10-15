# ADR 0032: «Что заказать» is a showcase, not a menu

## Status

Accepted.

## Context

The `dishes` module (docs/venue-modules.md) was a list of up to eight `{ name, priceRub, note }` rows. `signature_dishes` is an older list of five, shown only when that module is absent. A venue page should help a visitor see the few things the place wants to be known for. It should not copy a full menu.

Later, a guest will be able to leave a review and a food photo on one of those items. That needs a stable id now. Reviews themselves are not in this version.

## Decision

A venue has at most one `dishes` module, and that module has at most eight items. The cap is `venueModulesSchema`, so the cabinet and `venue_update` share it.

Each item stores:

- `id`, a stable token. The server assigns one when it is missing and keeps it across edits. A future review or guest photo attaches to `(venue id, item id)`. There is no reviews table yet.
- `name`
- `description`, a short line. The old item field `note` is accepted on input and copied here. The module-level `note` under the list stays.
- `priceRub`, optional
- `mediaId`, optional, a photo already attached to the venue
- `updatedAt`, when the price was last set or confirmed

A price with `updatedAt` older than 365 days is not shown. That is the same window as «Ориентиры цен» (`PRICE_FRESH_DAYS`). The item stays. Changing the name, the text, or the photo does not refresh the date. Changing the price, or the owner confirming the same price, does. A row with no date still shows its price, so a restored old revision does not go blank.

The owner uploads a photo in `/kabinet` with the same rights checkbox as the gallery. The file goes through the existing image pipeline. Origin is `venue`, and the photo is not promoted to the cover. An editorial write may set `mediaId` only when that photo is already on the venue with origin `own` or `commons`. Sending back the id that is already on the item keeps the other side's photo.

The public block is server-rendered cards: photo or a plain fallback, name, price, short text. When the page is indexable, the venue node gets a schema.org `Menu` of `MenuItem`s. A hidden price is omitted there too. `menuUrl` stays the official menu link, on the `Menu` when the showcase is present.

Migration `0029_dish_showcase` copies `note` into `description`, adds `id` and `updatedAt`, and does not delete `note` or `signature_dishes`. `updatedAt` is the migration time, so a price that is on the page today stays on the page. Search indexes the showcase names and texts as well as `signature_dishes`.

Revisions still store the whole venue row. Restoring one writes that snapshot back. A snapshot from before this change still renders (`note` as the short text, price shown). The next save assigns ids.

## Consequences

Eight items is the whole showcase. A longer menu stays a link. Guest reviews and guest photos are the next step and should key off `id` rather than the name. Owner photos and editorial photos can sit on the same list only because an unchanged `mediaId` is kept.

## Deferred

- Guest reviews and guest food photos on an item.
- Removing `signature_dishes` once every venue uses the module.
- A separate table of dish rows. The list stays inside `venues.modules` until reviews need their own rows.
