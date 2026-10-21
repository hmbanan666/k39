# ADR 0043: Anonymous event rows are not a session

## Status

Accepted. 2026-10-21.

## Context

ADR 0004 said the session id on `POST /api/events` was a random httpOnly cookie created on that request, and that `useTrack()` waited for one of two consent buttons, the second of which stored a consent cookie. It also said the consent banner and the privacy page describe that identifier. The app ships none of those controls.

The code does not do that:

- `apps/web-app/server/api/events/index.post.ts` calls `createId()` on every request and sets no cookie. `events.session_id` is `notNull`, so the insert needs a value, but the value is new for every row and does not group a visit.
- No page offers a consent choice for this endpoint. `useConsent()` can set a `k39_consent` cookie to `granted` or `denied`, and `useTrack()` posts only when `runtimeConfig.public.consentBanner` is true and that cookie is `granted`. No page calls `grant()` or `deny()`. The public flag defaults to false (`NUXT_PUBLIC_CONSENT_BANNER`).
- `/privacy` does not mention this endpoint or a session id for it. `CookieNotice` is the separate «Хорошо» card from ADR 0013. Dismiss writes `localStorage` key `k39_cookie_notice` and does not set a cookie.

ADR 0013 already records that `/api/collect` is cookieless while the flag is off, and that a granted consent on a beacon may set `k39_vid`, `k39_sid`, and `k39_seen`. Those cookies are the page-analytics visitor and session. They are not `events.session_id`.

Nothing reads `events.session_id` except the insert. `offer_codes.session_id` is a different nullable column.

## Decision

ADR 0004 keeps the consent rule and the ban on an IP address and a user id. The cookie sentence and the button sentence in that record are withdrawn.

Today `POST /api/events` accepts `eventCreateSchema` (`type`, optional place, route, and quest slugs, and `consent: true`). The handler writes one row with a fresh `createId()` in `session_id`, fills `place_id` when the place slug matches, and returns `{ ok: true, id }`. It does not read or write a cookie. `useTrack()` returns without calling the endpoint while `NUXT_PUBLIC_CONSENT_BANNER` is off.

Turning `NUXT_PUBLIC_CONSENT_BANNER` on does not, by itself, show a banner or start a session:

- `useTrack()` will post only after something sets `k39_consent=granted`. No control does that today. A later change that adds the buttons is a new record, and it has to name the buttons in the UI and in `/privacy` together.
- The events handler still mints a new id per row and still sets no cookie. It does not start reading `k39_sid`.
- `/api/collect` may then set `k39_vid`, `k39_sid`, and `k39_seen` for a beacon whose `k39_consent` cookie is `granted`, and it deletes those cookies otherwise. That behaviour stays in ADR 0013. It does not make `events.session_id` a session.

`events.session_id` carries no meaning. A follow-up should drop the column and stop writing it. Nullable is the smaller change only if a reader outside this repo still selects the column. This repository has no such reader. This record does not migrate. Until that follow-up the handler keeps writing `createId()` so the `notNull` constraint still holds. Reports must not group on the column.

## Consequences

ADR 0004, this record, ADR 0013, and `AGENTS.md` describe the same endpoint. The schema is unchanged. Accepting this record does not turn the consent flag on and does not add buttons. The privacy page is legal text and is not edited here. A sentence there that the product does not implement is an owner edit, not part of this decision.
