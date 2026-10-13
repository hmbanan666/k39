# ADR 0020: Place guide template

## Status

Accepted.

## Context

A place page is the main landing page from search. A visitor arrives with practical questions: what this is, how long it takes, when to come, what it costs, whether it is open, how to get there, and what else is nearby. The old template answered some of this in an aside (hours, price, address) and buried the rest in the article body. Questions and answers lived only as a «Частые вопросы» section inside the Markdown body, so the page could not render them as their own block, and editors had no field for them.

Our editorial rule is that every fact has a source. The page did not say when those facts were last checked, even though `last_verified_at` was already stored.

## Decision

Every place page follows one template. Each block hides when its data is empty, so a thin page stays honest instead of showing placeholders.

1. **Hero.** Title, category, region, and the summary as the lede: what the place is in one or two sentences. Actions: «Как добраться» (Yandex Maps route) and the route link when the place is a stop.
2. **«Коротко» answer block.** Rows in reading order: «Сколько времени» (`visit_duration`), «Когда ехать» (`best_time`), «Часы» (`hours`), «Цена» (`price`), address, coordinates. A footer stamp «Проверено {date}» comes from `last_verified_at`. On mobile the block sits right under the hero; on desktop it is the aside next to the body.
3. **Body.** The Markdown article.
4. **«Вопросы перед поездкой».** `faq`, 3 to 6 real visitor questions. Answers use only facts already listed in sources. The first item is open.
5. **Map, photos, «Где поесть рядом», «Рядом».** Nearby venues and places come from our own map data, sorted by distance.
6. **Route band and link lists.**
7. **«Источники».** The source list plus «Факты сверены с источниками {date}».

### Data

`places` gains three columns (migration `0015_place_guide`):

- `visit_duration varchar` - short Russian text, for example «1–2 часа».
- `best_time varchar` - short Russian text, for example «май–сентябрь, утром».
- `faq jsonb not null default '[]'` - `[{ question, answer }]`.

Free text, not numbers: sources state durations and seasons in words, and forcing minutes or months would invent precision. `place_create`, `place_update`, and `place_draft_update` accept the fields. `place_get` returns them. Omitting a field keeps it; null (or an empty array for `faq`) clears it.

### Structured data

The place page `@graph` holds:

- `BreadcrumbList`.
- The place node (`TouristAttraction`, plus the category type) with `@id` `{url}#place`, `geo`, `address`, `openingHours`, `isAccessibleForFree`, and `citation`.
- `WebPage` with `@id` `{url}#webpage`, `about` the place, `author` and `publisher` the K39 `Organization`, `dateModified` from `updated_at`, and `lastReviewed` from `last_verified_at`.
- `Organization` and `WebSite` nodes so the `@id` references resolve inside the page.
- `FAQPage` only when the page has questions. The structured `faq` field wins; a «Частые вопросы» body section is the fallback for older pages.

## Consequences

- Editors fill the answer fields through MCP; the admin form does not show them yet.
- Older pages keep working: empty fields hide their rows, and body FAQ sections still produce `FAQPage`.
- When `faq` is set, the body should not also carry a «Частые вопросы» section, or the questions repeat.
