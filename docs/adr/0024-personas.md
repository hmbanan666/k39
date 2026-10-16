# ADR 0024: Visitor personas as an editorial tool

## Status

Accepted

## Context

One page is read by people with different tasks: a family, a visitor without a car, a local looking for a weekend idea. ADR 0023 lets a page be built from modules and reordered by a chip picker, but editors still need to know who each page is for and which of their questions it leaves open.
Adapting pages to a visitor automatically comes later. First the site serves the broad audience, and personas guide what content to add.

## Decision

1. Eleven personas live in a code registry, `apps/web-app/shared/personas.ts`: `weekend`, `family`, `nocar`, `history`, `sea`, `foodie`, `local`, `returning`, `business`, `active`, `quest`. Each has a title, a job, the questions a page must answer, and the modules that serve it. Codes are stable; changing the list is a code change with review.
2. `page_personas` stores the targets of a page: page type, entity id, persona code, weight 1..3, and a primary flag. A partial unique index allows one primary per page.
3. The content MCP has `personas_list`, `page_personas_get` and `page_personas_set` (replace the list, exactly one primary, audited). Pages are resolved like page passports, by path or by type and slug.
4. `/admin/content-scores` shows each page's personas, primary first, and can filter pages without a primary persona.
5. Personas do not change what a page shows. Personas add up rather than compete: a page can serve several, and the picker answers of a visitor stay the only thing that reorders content.

## Consequences

Every published page should get a primary persona; the admin filter shows the gap.
A coverage score per persona (which of its questions and modules a page has) is the next step and builds on these rows. No duplicate pages are made per persona.

## Not doing yet

Inferring a visitor's persona, persona overrides of module order, journeys and next steps, and per-persona task metrics.
