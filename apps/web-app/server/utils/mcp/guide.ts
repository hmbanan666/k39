export const CONTENT_GUIDE = `K39 place pages are Russian. Write for a visitor who will go there, not for a brochure.

Tone: plain, specific, calm. No slogans, no "лучший", no invented atmosphere. Do not use an em dash in body copy.

Structure:
- summary: one or two sentences, what the place is and why a visitor stops.
- body: markdown. First paragraph states what it is and when it was built or opened, only if a source says so. Then a heading "## Как добраться" with the practical route. Optional heading "## Что посмотреть" only for things named in sources.
- hours, price: copy from sources or leave empty. Never guess a timetable or a ticket price.
- howToGet: the short address only, such as "Неман, ул. Победы, 47". The route itself belongs under the body heading "## Как добраться", not in this field.
- status: open, ruins, closed, or unknown. unknown if the source does not say.

Facts: if a source does not state it, do not write it. Coordinates, names, and dates come from the source list. Put each source in sources as { title, url }. factsCheckedAt is an ISO date (YYYY-MM-DD or a full timestamp) for the last fact check. place_update and place_draft_update store it as last_verified_at. Send it alone with id or slug to record a check without editing the article. Null clears it. Omit it to keep the stored date. Routes, collections, and hubs have no such field.

SEO: seoTitle stays under 70 characters, seoDescription under 170. The visible H1 is the place title. Do not keyword-stuff.

Publishing: you may set publicationStatus to published, or call content_set_publication. Publish only when the facts are in sources and every photo has alt, author, license, and sourceUrl. Unpublish by setting draft. noindex hides a live page from the sitemap, the same checkbox as in /admin. Do not invent a fact in order to publish.

Photos: alt is required and describes the picture. author, license, and sourceUrl are required for an upload. Do not attach a photo whose license is not own, cc-by, cc-by-sa, cc0, pd, or permission.

Routes and collections: route_draft_create, route_draft_update, and route_update take ordered points as [{placeSlug, note?}]. collection_save takes ordered items in the same shape. Every placeSlug must already exist. Omitting the array leaves the current stops. An empty array clears them. A short note is shown next to that stop. A collection whose places all share one region does not need a "## Как добраться" heading. A note or the place howToGet that gives an address or a transport line also covers that check. content_archive deletes a draft route or collection. A published or review row is archived: it leaves the site and the public URL returns 410. A draft route that a quest still links is not deleted. quest_save and quest_update take routeSlug to point the quest at another route, including a draft. null clears the link. Then content_archive can delete the draft.

Regions: regionSlug must be a slug from region_list. region_upsert creates or updates one by slug. name is the title. coordinates or center is an optional { latitude, longitude }. Do not invent a center.

Page passports: page_passport_get and page_passport_set store targetQueries, audience, primaryAction (build_route, buy_ticket, go_next_place, claim_offer, read), goal30d, goal90d, and notes for a place, route, collection, hub, or quest. claim_offer names the action. It does not create an offer. content_scores_list, content_score_get, and content_report_weekly read the 0-100 score. A score is quality, linking, indexing, and results. Refresh on content_score_get recomputes every page.

Venues: venue_create and venue_update edit cafes and other businesses. kind is cafe, restaurant, coffee, bar, bakery, market, fastfood, other, or a later latin token such as shop. OSM import (venue_import_osm) only creates drafts and does not overwrite an osmId that already exists. Publish only after a check, with a Russian description of 300-600 characters, and set lastVerifiedAt. A venue is stale after 180 days and leaves «Где поесть рядом» after 365. Do not invent hours or a bill. venue_listing_intro_set writes the text for /zavedeniya/{region}/{kind}. An intro of at least 300 characters is what makes that filter URL indexable.

Hubs: hub_update edits a category. body is markdown shown on the hub page. A heading line "## Частые вопросы" in that body becomes FAQPage, the same parser as a place. A question is a line "**…?**" or a "###" heading. The next "##" heading ends the section. seoTitle, seoDescription, ogImage, and noindex match /admin. Omitting a field keeps the stored value. The write is an mcp_audits row.
`

export function contentGuideMessages() {
  return {
    messages: [{
      role: 'user' as const,
      content: { type: 'text' as const, text: CONTENT_GUIDE },
    }],
  }
}
