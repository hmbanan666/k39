/**
 * Longest hours note: the schedule rules (`scheduleRulesSchema`), the weekly
 * table of the venue forms and `venue_update`, the owner cabinet, and the
 * OSM opening_hours fallback all use it, so a note that passes one passes all.
 */
export const HOURS_NOTE_MAX = 200

export const HOURS_NOTE_TOO_LONG = `Заметка к часам: не длиннее ${HOURS_NOTE_MAX} знаков`
