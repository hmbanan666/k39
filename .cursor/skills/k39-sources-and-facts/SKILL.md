---
name: k39-sources-and-facts
description: Use when choosing a source, a photo, hours, a price, or any fact for a K39 page. Covers allowed and banned sources, unknowns, and where attribution goes.
---

# K39 sources and facts

If a source does not state it, do not write it. Voice and the stop-list are `k39-writing`. Price matching is `k39-price-anchors`. Photo files and licenses in the pipeline are ADR 0011.

## Allowed

- The official site of the place, museum, administration, or venue (pages and menus).
- The venue's own official social account, for a fact that page states.
- OpenStreetMap, including `venue_import_osm`. Import creates a draft. It does not publish and it does not set `lastVerifiedAt`.
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

Do not invent a coordinate, a year, a ticket price, a capacity, or a closed day. OSM hours that were never set stay empty. The card says «Часы уточняйте». JSON-LD omits hours until a day has `opens` and `closes` (ADR 0018).

## Unknown

Write «уточняйте» (or leave the field empty where the template already says that).

- Hours with no official source: no schedule, or `needsCheck`. The place hours text stays a human summary of a real schedule only.
- Ticket or bill unknown: leave `price` empty. Do not guess a range.
- Status unknown: `unknown`.
- A dish or a price you did not see on an official menu: omit the row.

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

## Checklist

- Every number, name, date, and hour traces to an allowed source URL.
- Yandex, 2GIS, aggregators, delivery apps, and venue-site photos are unused.
- Unknowns say «уточняйте» or the field is empty. Nothing is guessed.
- `sources` and `factsCheckedAt` or `lastVerifiedAt` match this check.
- Photo `alt`, `author`, `license`, and `sourceUrl` are set. The article does not repeat the credit.
