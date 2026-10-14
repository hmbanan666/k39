# 0025. Static persona coverage

## Status

Accepted

## Context

ADR 0024 gives each page target personas, and each persona in the registry names the blocks it needs. Editors still had no view of which targeted persona a page leaves without those blocks. Traffic per persona does not exist yet, so the first measure has to come from the page data alone.

## Decision

1. `apps/web-app/shared/persona-coverage.ts` derives the blocks a page provides from stored data only: body text, sources, place FAQ, hours or price (short facts), how to get there (transport), stops (places), route and quest steps, and every page module (ADR 0023).
2. A text module may declare an optional `role` (`events`, `open-closed`, `bad-weather`, `transport`, `pack`, `prices`, `faq`, `short-facts`, `route-steps`, `eat-nearby`). The role is not rendered; it only names what the block answers. Headings are not parsed.
3. Coverage of a persona is the share of its registry blocks the page has, 0..100, plus the list of missing ones. A targeted persona below 50 is a gap.
4. `/api/admin/persona-coverage` returns a page × persona table for pages with targets. `/admin/content-scores` shows it under the score table: targeted cells highlighted, primary in bold, gaps in red, and a list of tasks such as «добавить как добраться».

## Consequences

Coverage moves only when content gains a block, so it is a to-do list for editors, not a quality grade. Blocks that no page type has yet (for example `eat-nearby` or `sea-today`) keep some personas low until those modules exist; that is intended and shows what to build next.

## Not doing yet

Answered-question checks per persona, `next-steps` journeys, task completion and depth by persona (they need consented events), and export of tasks.
