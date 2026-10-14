# 0027. Place and route bodies as typed sections

Status: accepted (amends ADR 0023)

## Context

Place and route articles were one markdown body. Standard headings such as
«Практика» lived in content, so renaming a section meant editing every page,
and pages drifted (some kept the old name, one had it twice).

## Decision

1. `places.sections` and `routes.sections` hold the article as an ordered list:
   `{kind: 'text', title?, text}` for free text (an untitled one is the intro),
   `{kind: 'useful', text}` and `{kind: 'directions', text}` for standard
   sections. Standard titles live once in `STANDARD_SECTION_TITLES`
   (`packages/database/src/body-sections.ts`).
2. The repository keeps body and sections in step on every save: sections
   given, the body is composed from them; only a body given, it is split on
   its `##` headings (old «Практика» maps to `useful`). Every write path (MCP,
   admin, content API) goes through it.
3. Public pages render the body composed from sections at read time, so a
   registry rename applies everywhere at once.
4. MCP `place_*` and `route_*` tools accept and return `sections`.

## Migration

Every place and route was re-saved with its own body. A page passes only when
the composed body has the same text as the original, with whitespace runs
collapsed (heading renames to the registry title excepted).
