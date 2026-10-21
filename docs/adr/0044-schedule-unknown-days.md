# ADR 0044: Weekdays with unknown hours

## Status

Accepted (2026-10-21). Amends ADR 0028 and ADR 0042.

## Context

A `week[]` entry says "open from X to Y" (or, after ADR 0042, "open from X"). A weekday that no entry lists is closed. Sources often state hours for some days and say nothing about others: a VK page or a map card gives Monday to Friday and is silent about the weekend. The writer then had two bad options: leave the day out, which renders «сб, вс выходные» and makes the live status say «Закрыто», or invent hours. Both break the facts rule in ADR 0033. `rules.needsCheck` drops the live status for the whole week, not for one day (issue #233).

## Decision

### Rules

A season gains an optional `unknownDays: number[]` (0..6, Sunday first, each day at most once). A day listed there has no known hours: it is neither open nor closed. Validation rejects a day that is both in `unknownDays` and in a `week[]` entry of the same season. A day that is in neither keeps today's meaning: closed. The field is optional and has no default, so stored rules parse to the same object as before and a re-save does not add the key.

The state is per season because hours are per season: a summer season can know the weekend while the winter season does not. A per-entry flag was set aside because an unknown day has no `opens`, and a separate top-level list would ignore seasons.

The day is resolved in this order, the same order `hoursOn` already uses:

1. An exception for that date wins (closed or its own hours).
2. A recurring closure (`closures[]`) closes the day.
3. `holidays: closed` closes a holiday. `holidays: sunday` reads the holiday as Sunday, so it is unknown when Sunday is.
4. A `week[]` entry for the weekday gives hours.
5. A weekday in `unknownDays` is unknown.
6. Otherwise the day is closed.

`hoursOn` returns null for an unknown day, as for a closed day. `dayStateOn` tells the two apart.

### Intervals

`expandIntervals` stores nothing for an unknown day, and `schedule_intervals` has no new column: there is no migration. Consumers learn which days are unknown from the rules themselves. `unknownSpans(rules, from, days)` returns those local days as instants, consecutive days merged, over the same window as the intervals. An interval that starts the evening before and runs past midnight into an unknown day is still open until its stated close.

### Status

`availabilityAt` takes the unknown spans next to the intervals:

- inside a current interval, the status is as before;
- otherwise inside an unknown span, the status is `unknown` with `unknownDay: true`. The text is «Сегодня часы уточняйте»;
- otherwise, when an unknown span starts before the next interval, the status is `closed` with no `opensAt` and `nextUnknown: true`. «Откроется в…» is never computed across a day whose hours are unknown, and `opening_soon` is never reported for it. The text is «Закрыто».

Slots mode follows the same rule: no next slot is named across an unknown day, and the text is «Закрыто», not «Ближайших сеансов нет».

`GET /api/public/availability` gives the same answer as the browser. Its query returns the rules of a schedule only when some season has `unknownDays`, and the handler computes the spans from them, so every other row costs nothing extra.

`OpeningLive` shows the unknown-day text as a muted line. «Часы не проверены» stays for unverified schedules only. The «Где поесть сейчас» lists put the venue in the unknown group on that day.

### Text

`describeSchedule` lists unknown days after the week entries and before the days off: «Пн–пт 10:00–19:00; сб, вс: часы уточняйте», or «Пн–пт 10:00–19:00; сб: часы уточняйте; вс выходной». An unknown day never appears as «выходной».

### Markup

`scheduleMarkup` builds `OpeningHoursSpecification` from `week[]` entries only, so an unknown day has no entry. Closed days from closures and exceptions are still emitted as special hours.

### Editing

`schedule_set` documents the field. The admin venue form and the owner cabinet both offer a third state per day, «часы уточняйте», next to «часы» and «выходной». Both forms load and save `venues.hours` through `shared/venue-hours-form.ts`, so a save that does not touch the hours keeps an unknown day unknown. `venues.hours` days carry `unknown: true` for it, the owner schema (`ownerVenueSchema`) keeps the flag, and `rulesFromVenueHours` turns those days into `unknownDays`. The cabinet still requires a closing time on an open day (ADR 0042 is admin only).

## Consequences

- Stored rules are unchanged and behave exactly as before: none has `unknownDays`, so intervals, status, text and markup are the same.
- Search engines may read a weekday without an `OpeningHoursSpecification` entry as closed. ADR 0042 drops all hours markup for an open-ended day; this record keeps the known days instead, because a known Monday to Friday is useful and the issue asks for the unknown days to be omitted. If that reading becomes a problem, `scheduleMarkup` can drop all regular hours when a season has `unknownDays`, as ADR 0042 does.
- The availability endpoint expands the rules of the schedules that have unknown days on each request. That is a small number of rows, and the expansion is the same code the browser runs.
- A week where every day is unknown is better stored as no schedule at all, so the page says «Часы уточняйте». `rulesFromVenueHours` returns no rules when no day has an opening time.
