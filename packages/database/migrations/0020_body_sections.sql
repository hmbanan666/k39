ALTER TABLE "places" ADD COLUMN "sections" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "sections" jsonb DEFAULT '[]'::jsonb NOT NULL;
