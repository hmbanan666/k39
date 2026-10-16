/**
 * Venue phone text. The fact is the value visitors see (ADR 0033).
 * `venues.phone` is a copy of that text, so it uses the same max.
 * Three grouped numbers fit. Postgres `varchar` has no length of its own.
 * Keep this equal to `PHONE_TEXT_MAX` in `apps/web-app/shared/facts.ts`.
 */
export const PHONE_TEXT_MAX = 200
