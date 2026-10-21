# ADR 0004: Consented anonymous events

## Status

Accepted. Partly superseded by [ADR 0043](0043-anonymous-events-session.md): there is no httpOnly session cookie and there are no consent buttons. The consent check, the absence of an IP column, and the absence of a user id still stand.

## Context

The product needs aggregated location analytics (which places and quests people open) under 152-FZ. Storing an account id or an IP address on every page view is more identity than that question needs.

## Decision

`POST /api/events` accepts a type, optional place/route/quest slug, and `consent: true`. The server sets the timestamp. A database check constraint rejects rows with `consent` not true. The events table has no IP column and no user id. Place id is filled when the slug matches a catalog row.

What `events.session_id` is, and what happens when `NUXT_PUBLIC_CONSENT_BANNER` is on, is ADR 0043. This record no longer describes a cookie or a pair of buttons.

## Consequences

A visitor who never consents is invisible to this table. There is no server-side geolocation check on quest marks. Page analytics are ADR 0013, not this table.
