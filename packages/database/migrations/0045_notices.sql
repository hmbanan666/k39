-- Dated temporary notices on places and venues (ADR 0049).
-- One row is one dated statement. It is not a fact and not a schedule.
-- The public read compares `starts_on` and `ends_on` with today in
-- Europe/Kaliningrad; `expired_at` is only the nightly cleanup flag.
-- No backfill and no seed.

CREATE TABLE IF NOT EXISTS "notices" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"subject_type" varchar NOT NULL,
	"subject_id" varchar NOT NULL,
	"kind" varchar NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"open_ended_reason" varchar,
	"text" varchar NOT NULL,
	"address" varchar,
	"source_url" varchar NOT NULL,
	"source_title" varchar NOT NULL,
	"checked_at" date NOT NULL,
	"expired_at" timestamp(3) with time zone,
	CONSTRAINT "notices_subject_check" CHECK ("subject_type" in ('place', 'venue')),
	CONSTRAINT "notices_kind_check" CHECK ("kind" in ('relocation', 'closed', 'renovation', 'other')),
	CONSTRAINT "notices_dates_check" CHECK ("ends_on" is null or "ends_on" >= "starts_on"),
	CONSTRAINT "notices_open_end_check" CHECK (("ends_on" is null) = ("open_ended_reason" is not null)),
	CONSTRAINT "notices_address_check" CHECK (("kind" = 'relocation') = ("address" is not null)),
	CONSTRAINT "notices_text_check" CHECK (char_length("text") between 1 and 160),
	CONSTRAINT "notices_address_length_check" CHECK ("address" is null or char_length("address") between 1 and 200),
	CONSTRAINT "notices_reason_length_check" CHECK ("open_ended_reason" is null or char_length("open_ended_reason") between 1 and 200),
	CONSTRAINT "notices_source_title_check" CHECK (char_length("source_title") between 1 and 160)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notices_subject_idx" ON "notices" USING btree ("subject_type","subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notices_open_idx" ON "notices" USING btree ("ends_on") WHERE "expired_at" is null;
