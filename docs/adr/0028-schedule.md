# 0028. One schedule primitive for every entity

Status: accepted

## Context

Opening times lived in three shapes: free text in `places.hours` (parsed for
markup when it happened to match), an OSM-style weekly table in
`venues.hours`, and nothing at all for events, beaches or offers. Search
queries such as «санитарный день» and «открыто сейчас» need one answer that
the page, the map and schema.org markup all share, and a stale cached page
must never claim a place is open.

## Decision

### Data model

1. `schedules` holds one row per entity: `entity_type` (`place`, `venue`,
   `event`, `route_stop`, `offer`), `entity_id`, `rules` (jsonb),
   `source_url`, `verified_at`, `updated_at`. Unique on (type, id). An entity
   without a row has status `unknown`.
2. `rules` is validated by zod (`shared/schedule.ts`) and always read in
   `Europe/Kaliningrad` wall time:
   - `mode`: `hours` (weekly schedule), `always` (24/7), `appointment` (by
     arrangement, never «open»), `closed` (closed until further notice),
     `events` (only listed occurrences).
   - `seasons[]`: optional inclusive `MM-DD` range (may wrap the new year,
     both empty = all year); `week[]` of `{days, opens, closes, breaks[],
     lastEntry?}`. `closes <= opens` means the interval runs past midnight.
     The most specific matching season wins.
   - `closures[]`: recurring closed days `{weekday, nth (1..5 or -1 for the
     last), label}`, e.g. last Monday of the month, «санитарный день».
   - `holidays`: `as-usual` | `closed` | `sunday` (use Sunday hours) on
     Russian public holidays (fixed list in code; government day transfers are
     not modelled and go in as exceptions).
   - `exceptions[]`: one-off dates, closed or with their own hours.
   - `occurrences[]`: event instances `{start, end}` as local date-times.
   - `note`: short free text shown under the schedule.
3. `verified_at` empty or `rules.needsCheck` → the schedule is shown as text
   but status is `unknown` and no markup is emitted.

### Materialised intervals

`schedule_intervals(entity_type, entity_id, starts_at, ends_at,
last_entry_at)` stores concrete open intervals as `timestamptz` for a rolling
window (today − 1 day … +30 days). It is rebuilt for one entity on every
schedule write and for all entities by a daily job. Breaks split intervals;
closures, holidays and exceptions remove them.

### Query API

`GET /api/public/availability?at=<ISO>&bbox=w,s,e,n&type=place,venue&status=open`
answers in one SQL query over `schedule_intervals` joined to entity
coordinates. Per entity: `status` (`open`, `closing_soon` ≤ 60 min left,
`opening_soon` ≤ 60 min to open, `closed`, `unknown`), `closesAt`,
`opensAt`, `minutesLeft`, `minutesToOpen`. `at` defaults to now, so the map
can ask «открыто сейчас» or «в субботу в 12:00».

### Rendering

One formatter: human lines («пн–пт 10:00–19:00, касса до 18:00»,
«Последний понедельник месяца: санитарный день»), schema.org
`openingHoursSpecification` (seasonal `validFrom`/`validThrough`) and
`specialOpeningHoursSpecification` (next closed days and exceptions). Live
status is computed only in the browser after hydration from the same rules;
SSR and cached HTML show the schedule, never «открыто сейчас».

### Editing

MCP: `schedule_get`, `schedule_set` (rules + source + verified date, or null
to delete), `schedules_list` (filter by type, unverified). Writes are
audited and rematerialise intervals.

## Edge cases

- Kaliningrad has no DST today; times are still converted through the IANA
  zone so a future change needs no data migration.
- 24/7 is `mode: always`; «по записи» is `appointment`, never open.
- Overnight intervals end on the next calendar day.
- Unknown or unverified schedules are `unknown`, never `closed`.
- Old `places.hours` text stays as a note; recognised strings were migrated
  into rules, the rest are listed as needing verification.
- `venues.hours` migrate as rules. `verified_at` is the venue's
  `last_verified_at` (Kaliningrad date) when an editor checked it, else empty,
  so OSM-only hours read as text but report `unknown` until checked.
  Migration 0022 backfilled this for venues migrated before the fix, and
  venue writes that set hours or `lastVerifiedAt` keep the schedule in step.
