# ADR 0004: Consented anonymous events

## Status

Accepted

## Context

The product needs aggregated location analytics (which places and quests people open) under 152-FZ. Storing an account id or an IP address on every page view is more identity than that question needs.

## Decision

`POST /api/events` accepts a type, optional place/route/quest slug, and `consent: true`. The server sets the timestamp. The session id is a random httpOnly cookie created only on this request. A database check constraint rejects rows with `consent` not true. `useTrack()` does not call the endpoint until the visitor chooses "Разрешить аналитику". "Не записывать" stores a consent cookie and sends nothing.

The events table has no IP column and no user id. Place id is filled when the slug matches a catalog row.

## Consequences

A visitor who never consents is invisible to analytics. The session id is still an online identifier, so the consent banner and the privacy page describe it. There is no server-side geolocation check on quest marks.
