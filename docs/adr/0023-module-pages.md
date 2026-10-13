# 0023. Pages built from modules, with a chip picker

## Status

Accepted

## Context

Month guides and collections are long articles. A visitor comes with a task (decide whether to go in October, plan a day, find what fits a family or a trip without a car) and has to read 8 to 11 thousand characters to solve it.
The map on a month guide only repeats the places mentioned in the text, which does not help with any task.
Different visitors want different parts of the same page first, but search engines and visitors without JavaScript must still get the whole page.

## Decision

1. A page can be an ordered list of typed modules. For collections this is the `collections.modules` jsonb column. An empty list keeps the article layout, so every page moves over on its own.
2. Module types and their shapes are one zod schema in `apps/web-app/shared/page-modules.ts`: `text` (lead or plain markdown), `month-stats` (tiles plus the full table), `picker`, `ideas` and `plans` (cards with markdown and tags), `places` (the ordered items as place cards), `months` (chips for the twelve guides). New types are added to that schema and to `PageModuleList`.
3. Modules are edited through the content MCP: `collection_save` takes `modules` and validates it with the same schema, `collection_get` returns it. Moving an article into modules reuses its prose verbatim. `body` stays stored as the archive and as the source for JSON-LD.
4. The server renders every module in full and in its stored order. A stored list that stops validating falls back to the article body rather than half a frame.
5. The picker asks at most three chip questions (`interest`, `company`, `transport`). Answers live only in the URL (`?i=more,istoriya&c=deti&t=bez-mashiny`), so a link can be shared and the server renders the same order. Nothing is stored without consent.
6. The picker never hides content. A card that matches an answer and misses none moves up and is marked «Под ваш выбор». A card with no tag for a question is neutral on it. Cards that miss move down but stay. Place cards get interest tags from their category.
7. A URL with picker params has the canonical of the clean page and `noindex`. Yandex gets `Clean-param: i&c&t /podborki/`.
8. A map appears only where place or order is the task (routes, nearby, towns, `/map`). A page built from modules has no map of mentioned places.

## Consequences

The default page is complete for search engines; the picker changes only order and hints, so it cannot conflict with indexing.
Editors tag cards with a fixed vocabulary, and a wrong tag only moves a card.
Each page type still needs its own default frame. October is the first page that uses it; other months and collections follow as their content is moved.

## Not doing yet

Personas and page persona tags, coverage per persona in `/admin/content-scores`, saved preferences, structured climate, events and day-plan tables, map on demand, and JSON-LD for ideas and FAQ. These are later phases of the same plan.
