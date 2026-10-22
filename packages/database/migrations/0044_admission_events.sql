CREATE TABLE "admission_prices" (
	"id" varchar PRIMARY KEY NOT NULL,
	"subject_type" varchar NOT NULL,
	"subject_id" varchar NOT NULL,
	"slot" varchar NOT NULL,
	"audience" varchar NOT NULL,
	"price_rub" integer NOT NULL,
	"condition" text,
	"label" varchar,
	"source_url" varchar NOT NULL,
	"source_title" varchar NOT NULL,
	"checked_at" date NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admission_prices_subject_check" CHECK ("subject_type" in ('place', 'venue', 'route')),
	CONSTRAINT "admission_prices_audience_check" CHECK ("audience" in ('general', 'reduced', 'family', 'foreign', 'free')),
	CONSTRAINT "admission_prices_price_check" CHECK (("audience" = 'free' and "price_rub" = 0) or ("audience" <> 'free' and "price_rub" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admission_prices_subject_slot" ON "admission_prices" USING btree ("subject_type","subject_id","slot");
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"subject_type" varchar NOT NULL,
	"subject_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"starts_at" timestamp(3) with time zone NOT NULL,
	"ends_at" timestamp(3) with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"ticket_url" varchar,
	"source_url" varchar NOT NULL,
	"source_title" varchar NOT NULL,
	"checked_at" date NOT NULL,
	"cancelled_at" timestamp(3) with time zone,
	"expired_at" timestamp(3) with time zone,
	CONSTRAINT "calendar_events_subject_check" CHECK ("subject_type" in ('place', 'venue')),
	CONSTRAINT "calendar_events_end_check" CHECK ("ends_at" is null or "ends_at" > "starts_at")
);
--> statement-breakpoint
CREATE INDEX "calendar_events_subject_idx" ON "calendar_events" USING btree ("subject_type","subject_id","starts_at");
--> statement-breakpoint
CREATE INDEX "calendar_events_live_idx" ON "calendar_events" USING btree ("starts_at") WHERE "cancelled_at" is null and "expired_at" is null;
--> statement-breakpoint
ALTER TABLE "facts" DROP CONSTRAINT "facts_kind_check";
--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_kind_check" CHECK ("kind" in ('hours', 'price', 'phone', 'address', 'coordinates', 'status', 'admission', 'event'));
