ALTER TABLE "places" ADD COLUMN "visit_duration" varchar;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "best_time" varchar;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "faq" jsonb DEFAULT '[]'::jsonb NOT NULL;
