CREATE TABLE "content_drafts" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "entity_type" varchar NOT NULL,
  "entity_id" varchar NOT NULL,
  "publication_status" varchar DEFAULT 'review' NOT NULL,
  "payload" jsonb NOT NULL,
  CONSTRAINT "content_drafts_status_check" CHECK ("publication_status" in ('draft', 'review'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "content_drafts_entity_idx" ON "content_drafts" USING btree ("entity_type","entity_id");
