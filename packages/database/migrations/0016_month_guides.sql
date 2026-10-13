ALTER TABLE "collections" ADD COLUMN "kind" varchar DEFAULT 'theme' NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "month" integer;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "collections_month_guide" ON "collections" ("month") WHERE "kind" = 'month';
