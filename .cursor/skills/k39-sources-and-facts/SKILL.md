---
name: k39-sources-and-facts
description: Use when choosing a source, a photo, hours, a price, or any fact for a K39 page. Covers allowed and banned sources, venue source priority, unknowns, and where attribution goes.
---

# K39 sources and facts

If a source does not state it, do not write it. Voice and the stop-list are `k39-writing`. Price matching is `k39-price-anchors`. Photo files and licenses in the pipeline are ADR 0011.

## Allowed

- The official site of the place, museum, administration, or venue (pages and menus).
- The venue's own official social account, for a fact that page states.
- OpenStreetMap, including `venue_import_osm`. Import creates a draft. It does not publish and it does not set `lastVerifiedAt`. For a venue, OSM does not outrank the official site. See Venue facts.
- Wikimedia Commons, through `commons_search` and `commons_import`. Licenses: `cc-by`, `cc-by-sa`, `cc0`, `pd`.
- Our own shots (`license: own`).
- A file the venue sent us, with permission (`origin: venue` on a venue photo, or `license: permission`). That is not a download from their website.

Record each fact source as `{ title, url }` on the page. Set `factsCheckedAt` (places) or `lastVerifiedAt` (venues) to the day you checked. An ISO date is `YYYY-MM-DD`.

## Banned

Do not take facts, hours, prices, reviews, ratings, or photos from:

- Yandex, including Maps, Business, and food cards
- 2GIS
- Aggregators and other guides
- Photos hosted on the venue's own website (use our shot, Commons, or a file they sent)
- Delivery apps

Never name `kgdmore.ru`. The ban lives in `WRITING_BANNED_SITES` (`apps/web-app/shared/writing.ts`).

Do not invent a coordinate, a year, a ticket price, a capacity, or a closed day. JSON-LD omits hours until a day has `opens` and `closes` (ADR 0018).

## Venue facts

For a venue, take address, hours, phone, and menu in this order:

1. The venue's official site.
2. OpenStreetMap, only to fill a field the site does not state.
3. Nothing.

On a conflict, the official site wins. Do not replace a site address, hour, phone, or menu line with the OSM value. OSM is for coordinates and for those fill-ins. Do not take the pin from a guessed point.

Use «уточняйте» only when the official site says nothing about that field and OSM has no fill-in. If the site states the fact, write the fact. An empty hours week still renders «Часы уточняйте» (ADR 0018). That is the empty state, not a reason to ignore the site.

`venue_import_osm` still creates a draft and does not publish. After import, check the official site and overwrite any conflicting address, hours, phone, or menu before publish.

## Unknown

For a place, write «уточняйте» (or leave the field empty where the template already says that) when the official source is silent.

- Place hours with no official source: no schedule, or `needsCheck`. The hours text stays a human summary of a real schedule only.
- Ticket or bill unknown: leave `price` empty. Do not guess a range.
- Status unknown: `unknown`.
- A dish or a price you did not see on an official menu: omit the row.
- Venue fields: follow the order above. «уточняйте» is the last step, not a substitute for the official site.

«Проверено {date}» uses `last_verified_at`. Do not type a date you did not check.

## Photos

`alt`, `author`, `license`, and `sourceUrl` are required. Allowed licenses: `own`, `cc-by`, `cc-by-sa`, `cc0`, `pd`, `permission`.

Attribution stays in the media fields. `<MediaImage>` and the JSON-LD credit render it (ADR 0011, `shared/media.ts`). Do not write «Фото: …» into the article.

A venue dish photo is already attached to that venue. Editorial writes may newly use origin `own` or `commons`. An owner upload is origin `venue` and is not the cover (ADR 0032).

## Examples

Bad: hours copied from a Yandex card, with no official page in `sources`.

Good: `schedule_set` with `sourceUrl` of the museum page and `verifiedAt` of the day you opened it. When that page has no hours, leave the schedule empty so the card says «Часы уточняйте».

Bad: a hero image saved from the cafe's site, or from 2GIS.

Good: `commons_import` of a CC BY file, or our own photo with `author` and `license: own`.

Bad: «Билет около 300 ₽» because a blog said so.

Good: an empty price, and the sentence «Стоимость билета уточняйте», until the official page states a number.

Bad: the cafe site says 10:00–22:00 and OSM says 11:00–23:00, and the page stores the OSM hours.

Good: store 10:00–22:00 from the site, with that page as the source. Keep the OSM coordinates. If the site has no phone and OSM has one, use the OSM phone. If neither has a phone, «уточняйте».

## Checklist

- Every number, name, date, and hour traces to an allowed source URL.
- Yandex, 2GIS, aggregators, delivery apps, and venue-site photos are unused.
- A venue address, hours, phone, and menu come from the official site. OSM only fills a gap and supplies coordinates. A conflict keeps the site.
- «уточняйте» is used only where the official site says nothing and, for a venue, OSM has no fill-in. Nothing is guessed.
- `sources` and `factsCheckedAt` or `lastVerifiedAt` match this check.
- Photo `alt`, `author`, `license`, and `sourceUrl` are set. The article does not repeat the credit.
