-- ADR 0042: an interval from a day with no known closing time. Its ends_at
-- is the end of that local day and is never shown as a closing time.
ALTER TABLE "schedule_intervals" ADD COLUMN "open_ended" boolean DEFAULT false NOT NULL;
