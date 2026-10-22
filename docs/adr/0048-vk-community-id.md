# ADR 0048: Declared VK community id for menu prices

## Status

Accepted (2026-10-22).

## Context

ADR 0039 counts a VK menu price only when `venues.website` is empty and the price community matches a VK link in `socials`. The match compares a screen name with a screen name, or a numeric id with a numeric id.

Socials usually hold the screen-name link a venue publishes (`vk.com/lugowen_gastro`). The menu itself is an album, a photo, a post, or a market item, and those URLs carry only the numeric owner id (`vk.com/album-236300695_311487837`, `market-71522139`, `wall-123_456`, `?z=photo-123_456`). Nothing in the row says that `lugowen_gastro` is community 236300695, so a real official VK menu price is stored and never counted.

The server cannot resolve the name. Calling the VK API or fetching VK pages at runtime or in CI adds a credential, a rate limit, and a network dependency to a pure comparison. Adding a second `vk.com/club236300695` link to `socials` would make the match work but show the same community twice on the public page and in JSON-LD `sameAs`.

## Decision

`venues.vk_community_id` is a nullable `bigint` with a check `> 0`. It is the numeric id of the VK community that `socials` link by screen name. An editor reads the number from that community's own album, photo, wall, or market URL and sets it in `/admin/venues/{id}` or with `venue_update` (`vkCommunityId`). `venue_get` returns it. It is not shown on the public page and does not change `sameAs`.

Matching (`vkMenuMatchesSocial` in `packages/types/src/vk-community.ts`) adds the declared id to the communities of the stored VK links. A price whose owner is `-<id>` (`album-`, `photo-`, `wall-`, `market-`, `doc-`, `topic-`, `video-`, `product-`, or a `w=`/`z=` object), or whose path is `club<id>`, `public<id>`, or `event<id>`, then matches a screen-name social. The id counts only while at least one VK link is in `socials`. A `club`, `public`, or `event` link in `socials` already carries its id and needs no declaration. The website rule of ADR 0039 is unchanged.

The writer (`Venues.create`, `Venues.update`) validates an explicit value:

- a positive integer, as a number or a string of digits; anything else is rejected with a message that names the field
- a VK link in `socials` after the write
- when every VK link already carries a numeric community, the id is one of those numbers, so a typo is not stored as a second community

A write that omits the field keeps the stored id only while it still passes the last two checks against the new `socials`, and clears it otherwise: when the last VK link goes, or when every remaining VK link is numeric and none is that id. An owner edits `socials` in the cabinet and cannot see the field, so an owner save is never refused because of it and does not leave a stale id behind. A screen-name change keeps the id: the number is what survives a rename.

The parser that used to live in `apps/web-app/shared/price-compare.ts` moves to `@k39/types/vk-community`, so the database writer and the comparison read VK URLs the same way.

## Consequences

- Real VK menu prices count once an editor sets the id. Until then they stay stored and out of the town sample, as before.
- The id is editorial data. It is not checked against VK. A wrong number on a screen-name venue would let another community's prices count; the editor takes it from the venue's own album or market URL, the same page that is the price source.
- A screen-name change keeps the id, because the writer cannot tell a renamed community from a different one. When a venue moves to another VK community under a new screen name, the editor clears the id (null) or sets the new number; otherwise the old community's album, photo, wall, and market prices keep counting.
- `socials` stays the list the page shows. No duplicate link is added.
- Migration `0042_venue_vk_community_id.sql` adds the column and the check. Revisions snapshot and restore it with the other venue fields.
