# ADR 0042: Opening hours with an unknown closing time

## Status

Accepted (2026-10-21). Amends ADR 0028.

## Context

ADR 0028 requires every weekly entry to have `opens` and `closes`. Some official sources give only a start time («завтраки с 07:00, меню с 12:00»). Such a venue could not be stored: the writer rejected the entry, the day was dropped, and the page reported «Закрыто» on a day the venue is open (issue #221). Guessing a closing time breaks the facts rule in ADR 0033.

## Decision

### Rules

A `week[]` entry may omit `closes`. When `closes` is present, nothing changes: `closes <= opens` still means the interval runs past midnight. When it is missing, the entry is open-ended: open from `opens`, and the schedule claims nothing after the end of that local day. Validation on an open-ended entry:

- each break satisfies `opens < from < to`, on the same day;
- `lastEntry`, when set, is later than `opens` on the same day.

Exceptions (`exceptions[]`) keep their current shape: an exception without `closes` is still a closed day, so stored rules read as before. The admin venue form and `rulesFromVenueHours` treat a day with an opening time and an empty closing time as open-ended. The owner cabinet keeps its current behaviour.

### Intervals

`expandIntervals` stores an open-ended day as an interval from `opens` to the end of that local day (00:00 the next day), with `openEnded` set. Breaks split it as usual, and every part keeps the flag. `schedule_intervals` gains `open_ended boolean not null default false` (migration 0040). `ends_at` stays not null, so the index and every existing query keep working. For an open-ended row, `ends_at` is the limit of what the schedule claims, not a closing time.

### Status

From `opens` until the end of that local day the status is `open` with `openEnded: true` and `openedAt`. `closesAt`, `minutesLeft` and `closing_soon` are never computed for that day, including the parts before a break. The text is «Открыто с 12:00, закрытие уточняйте», on the venue page and on cards (`hideRemaining` has no countdown to drop). Before opening the usual text applies: «Закрыто, откроется сегодня в 12:00». After local midnight the open-ended day is over and the next day is read on its own rules. The availability query returns `current_start` and `current_open_ended` for the current interval, so `GET /api/public/availability` gives the same answer as the browser. Unverified schedules stay `unknown`, as in ADR 0028.

`status: 'open'` was chosen over `unknown` after opening. The source states the venue opens at that time, so the «открыто сейчас» filter on the map and in listings includes it, and the text names the gap. A venue that is known to run past midnight needs its closing time recorded; open-ended is only for a source that gives none.

### Text

`describeSchedule` renders an open-ended entry as «ежедневно с 12:00, закрытие уточняйте». Breaks and the last entry come before «закрытие уточняйте». No relative-time words.

### Markup

schema.org `OpeningHoursSpecification` has no "unknown" closing time, and search engines read a missing day as closed. When any week entry is open-ended, `scheduleMarkup` returns no `openingHoursSpecification` and no `specialOpeningHoursSpecification` for that entity. A page with a schedule never falls back to hours text for markup, and an empty spec is not emitted.

## Consequences

- Stored rules are unchanged. Every existing entry has `closes`, so its intervals, status, text and markup are the same as before.
- `schedule_set` documents `closes` as optional. Agents omit it only when the source states an opening time and no closing time.
- A venue with one open-ended day loses all opening-hours markup until its closing time is known. That is the cost of not inventing one.
- Migration 0040 adds a column with a default. The daily interval refresh fills the flag for new rows; existing rows read as `false`, which is correct for every rule stored today.
