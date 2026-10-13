CREATE TABLE "collection_media" (
	"id" varchar PRIMARY KEY NOT NULL,
	"collection_id" varchar NOT NULL,
	"media_id" varchar NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_media" ADD CONSTRAINT "collection_media_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collection_media" ADD CONSTRAINT "collection_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_media_collection_media" ON "collection_media" USING btree ("collection_id","media_id");--> statement-breakpoint
CREATE INDEX "collection_media_collection_idx" ON "collection_media" USING btree ("collection_id");
