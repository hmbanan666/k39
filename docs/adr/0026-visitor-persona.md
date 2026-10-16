# ADR 0026: Visitor persona on the client

## Status

Accepted

## Context

ADR 0023 reorders cards by picker answers in the URL; ADR 0024 gives pages target personas for editors. A returning visitor still had to answer the picker on every page, and nothing explained why cards moved.

## Decision

1. The picker has one more row, «Кто вы в поездке?», with four choices: `local` (Я местный), `weekend` (Турист), `family` (С детьми), `nocar` (Без машины). The header stays as it is.
2. The choice is stored in `localStorage` under `k39.persona` and nowhere else: no cookie, no server profile, no analytics field. Picker answers can also infer it (`deti` gives family, `bez-mashiny` gives nocar); an explicit choice always wins over an inferred one.
3. The persona only fills picker hints for questions the page asks (`shared/visitor-persona.ts`), and only after hydration. Answers in the URL win over the persona. The server render, canonical and indexable content are the same for every visitor and for bots.
4. The status line names the reason («потому что вы выбрали …») with a reset, and «Почему я это вижу» says what is stored and where.

## Consequences

Nothing is hidden and SSR stays deterministic. Personas without a matching question on a page (for example `local`) do not reorder that page yet; module-level overrides are the next phase.

## Not doing

Server-side profiles, inference from referrer or location, and storing raw signals.
