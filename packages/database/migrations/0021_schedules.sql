CREATE TABLE "schedules" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"rules" jsonb NOT NULL,
	"source_url" varchar,
	"verified_at" date,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_entity" ON "schedules" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE TABLE "schedule_intervals" (
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"starts_at" timestamp(0) with time zone NOT NULL,
	"ends_at" timestamp(0) with time zone NOT NULL,
	"last_entry_at" timestamp(0) with time zone
);
--> statement-breakpoint
CREATE INDEX "schedule_intervals_entity" ON "schedule_intervals" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "schedule_intervals_time" ON "schedule_intervals" USING btree ("starts_at","ends_at");
