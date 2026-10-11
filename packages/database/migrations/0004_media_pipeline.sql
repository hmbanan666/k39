ALTER TABLE "media" ADD COLUMN "status" varchar DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "variants" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "lqip" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "dominant_color" varchar;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "focal_x" double precision DEFAULT 0.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "focal_y" double precision DEFAULT 0.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "license" varchar;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "author" varchar;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "caption" text;--> statement-breakpoint
UPDATE "media" SET "author" = "credit" WHERE "author" IS NULL AND "credit" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "place_media" (
	"id" varchar PRIMARY KEY NOT NULL,
	"place_id" varchar NOT NULL,
	"media_id" varchar NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
ALTER TABLE "place_media" ADD CONSTRAINT "place_media_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "place_media" ADD CONSTRAINT "place_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "place_media_place_media" ON "place_media" USING btree ("place_id","media_id");--> statement-breakpoint
CREATE INDEX "place_media_place_idx" ON "place_media" USING btree ("place_id");--> statement-breakpoint
INSERT INTO "place_media" ("id", "place_id", "media_id", "sort_order", "is_cover")
SELECT substr(md5("id" || '-gallery'), 1, 24), "place_id", "id", "sort_order", ("sort_order" = 0)
FROM "media"
WHERE "place_id" IS NOT NULL;
