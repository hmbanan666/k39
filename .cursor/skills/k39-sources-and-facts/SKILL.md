---
name: k39-sources-and-facts
description: Use when choosing a source, a photo, hours, a price, or any fact for a K39 page. Covers allowed and banned sources, venue source priority, map fact fields, unknowns, and where attribution goes.
---

# K39 sources and facts

If a source does not state it, do not write it. Voice and the stop-list are `k39-writing`. Price matching is `k39-price-anchors`. Photo files and licenses in the pipeline are ADR 0011.

Verification of a fact that is already stored starts at `queue_list` (ADR 0033). Do not walk `places_list` to re-check a fact that is still inside its TTL. `fact_get` reads the claim, `fact_confirm` accepts the same value hash, and `fact_update` writes a new one. A map or OSM phone uses the same 180-day TTL as an official phone and is not fetched. The content token does not overwrite a fact whose latest revision actor is owner. That conflict waits for an editor in `/admin`.

Never contact a venue. Never do outreach. Never ask a venue for photos or data.

Never copy another site's content: not the sentences, not the photos, and not the structure. Write from the source facts in our order.

## Allowed

- The official site of the place, museum, administration, or venue (pages and menus).
- The venue's own official social account, for a fact that page states.
- OpenStreetMap, including `venue_import_osm`. Import creates a draft. It does not publish and it does not set `lastVerifiedAt`. For a venue, OSM does not outrank the official site. See Venue facts.
- Yandex Maps and 2GIS, only for a venue that really exists and operates, and only for the fact fields in Venue facts. Store the card in `sources` the same way as any other source.
- Wikimedia Commons, through `commons_search` and `commons_import`. Licenses: `cc-by`, `cc-by-sa`, `cc0`, `pd`.
- Our own shots (`license: own`).
- A file the venue sent us, with permission (`origin: venue` on a venue photo, or `license: permission`). That is not a download from their website.

Record each fact source as `{ title, url }` on the page. That array is the machine source list. The public page renders it in the collapsed «Источники» block. On a place, the same URLs are JSON-LD `citation` and `sameAs`. A Yandex Maps or 2GIS card used for a fact goes in that list. Do not paste the card's text into the article, the description, or a module. Set `factsCheckedAt` (places) or `lastVerifiedAt` (venues) to the day you checked. An ISO date is `YYYY-MM-DD`. When venue hours come from a map card, pass that same URL as `schedule_set` `sourceUrl`.

## Banned

Do not take facts, hours, prices, reviews, ratings, or photos from:

- Yandex Business and Yandex food cards
- Aggregators and other guides
- Photos hosted on the venue's own website (use our shot, Commons, or a file they sent)
- Delivery apps

Yandex Maps and 2GIS are not a content source. From those cards, do not take texts, descriptions, photos, reviews, ratings, an average check, or prices. Prices stay the official menu only (`k39-price-anchors`).

Never name `kgdmore.ru`. The ban lives in `WRITING_BANNED_SITES` (`apps/web-app/shared/writing.ts`).

Do not invent a coordinate, a year, a ticket price, a capacity, or a closed day. JSON-LD omits hours until a day has `opens` and `closes` (ADR 0018).

## Venue facts

Use Yandex Maps, 2GIS, or Google Maps only for a venue that really exists and operates. The card may be what establishes that it is operating, and that status is one of the allowed facts. Do not use a card you cannot tie to that venue. If the card says the venue has closed, record the closed status. Do not copy a timetable as if it were still open.

For a venue, take address, hours, phone, whether it is open or operating, and coordinates in this order:

1. The venue's official site.
2. Yandex Maps, 2GIS, Google Maps, and OpenStreetMap, only for a fact the site does not state.
3. «уточняйте».

`map_google` is the same kind of source as `map_yandex` and `map_2gis`: venues only, and only those fact fields. It sits below the official site. A Google result, a Google Business profile, and a Google page that is not a map card are not a source.

On a conflict, the official site wins. Do not replace a site address, hour, phone, operating status, or coordinate with a map or OSM value. Maps and OSM fill a gap. They do not override the site. If two maps disagree and the site is silent, do not blend the two values. Record one of them with its URL, or write «уточняйте». Do not take the pin from a guessed point.

Menu lines and prices stay the official menu: a page on the venue's site or a PDF on that site. Yandex Maps, 2GIS, Google Maps, aggregators, and delivery apps do not supply them.

Use «уточняйте» only when the official site says nothing about that field and neither a map card nor OSM states it. If the site states the fact, write the fact. An empty hours week still renders «Часы уточняйте» (ADR 0018). That is the empty state, not a reason to ignore the site or a map card that states the hours.

`venue_import_osm` still creates a draft and does not publish. After import, check the official site and overwrite any conflicting address, hours, phone, or menu before publish. A map card may fill a fact the site still does not state. Put that card in `sources`.

## Unknown

For a place, write «уточняйте» (or leave the field empty where the template already says that) when the official source is silent. Place hours, phone, address, and coordinates do not come from Yandex Maps, 2GIS, or Google Maps.

- Place hours with no official source: no schedule, or `needsCheck`. The hours text stays a human summary of a real schedule only.
- Ticket or bill unknown: leave `price` empty. Do not guess a range.
- Status unknown: `unknown`.
- A dish or a price you did not see on an official menu: omit the row.
- Venue fields: follow the order above. «уточняйте» is the last step, after the official site and after a map or OSM fill-in.

«Проверено {date}» uses `last_verified_at`. Do not type a date you did not check.

## Photos

Editorial photos are Wikimedia Commons or our own shots. Licenses: `own`, `cc-by`, `cc-by-sa`, `cc0`, `pd`.

`permission` and origin `venue` are owner uploads in the cabinet only. The content token refuses both (`media_upload_from_url`, `media_attach_to_venue`). Do not download a photo from the venue site, from Yandex Maps, or from 2GIS.

`alt`, `author`, `license`, and `sourceUrl` are required.

Attribution lives in the markup: the media fields feed JSON-LD (`shared/media.ts`, ADR 0011) and the collapsible «Источники» block (`<details>` with summary «Источники», as on the place page and the venue page). Do not write «Фото: …» into the article.

A venue dish photo is already attached to that venue. An editorial write may newly use origin `own` or `commons`. An owner cabinet upload is origin `venue` and is not the cover (ADR 0032). Sending back the id already on the item keeps that photo.

## Examples

Bad: a description, a review, a rating, or an average check copied from a Yandex Maps or 2GIS card.

Good: the cafe site has no phone. The venue exists and operates. The phone is the one on the Yandex Maps or 2GIS card, and that card is `{ title, url }` in `sources`.

Bad: hours taken from a map card and typed into the article, with the card left out of `sources`.

Good: `schedule_set` for that venue with `sourceUrl` of the map card and `verifiedAt` of the day you opened it, and the same URL in `sources`. When the site states the hours, `sourceUrl` is the site, not the map.

Good: `schedule_set` for a museum with `sourceUrl` of the museum page and `verifiedAt` of the day you opened it. When that page has no hours, leave the schedule empty so the card says «Часы уточняйте». Do not fill a place schedule from Yandex Maps or 2GIS.

Bad: a hero image saved from the cafe's site, or from 2GIS.

Good: `commons_import` of a CC BY file, or our own photo with `author` and `license: own`.

Bad: «Билет около 300 ₽» because a blog said so.

Good: an empty price, and the sentence «Стоимость билета уточняйте», until the official page states a number.

Bad: the cafe site says 10:00–22:00 and a map or OSM says 11:00–23:00, and the page stores the map or OSM hours.

Good: store 10:00–22:00 from the site, with that page as the source. Keep coordinates from the site when it states them, otherwise from the map or OSM. If the site has no phone and a map or OSM has one, use that phone and record its URL in `sources`. If none of them has a phone, «уточняйте».

Bad: a price row whose `sourceUrl` is a Yandex Maps or 2GIS page.

## Checklist

- Verification of a stored fact started at `queue_list`.
- Every number, name, date, and hour traces to an allowed source URL in `sources`.
- Yandex Maps, 2GIS, and Google Maps, when used, are only for a venue that exists and operates, and only for hours, phone, address, operating status, and coordinates. The card URL is in `sources`. No text, description, photo, review, rating, average check, or price comes from them. Google Maps is `map_google`, below the official site, same as the other map cards.
- Yandex Business, Yandex food cards, aggregators, delivery apps, and venue-site photos are unused.
- A venue address, hours, phone, operating status, and coordinates come from the official site first. Maps and OSM fill a fact the site does not state. A conflict keeps the site. Then «уточняйте». Prices and menu lines stay the official menu.
- «уточняйте» is the last step. Nothing is guessed.
- `sources` and `factsCheckedAt` or `lastVerifiedAt` match this check.
- Photo `alt`, `author`, `license`, and `sourceUrl` are set. The credit is in JSON-LD and «Источники», not in the article.
- No one contacted the venue or asked it for photos or data.
- The text, the photos, and the structure are ours. Nothing is copied.
