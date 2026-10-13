CREATE TABLE "venues" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"slug" varchar NOT NULL,
	"name" varchar NOT NULL,
	"kind" varchar NOT NULL,
	"cuisine_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"region_id" varchar,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"price_level" integer,
	"avg_check" integer,
	"hours" jsonb DEFAULT '{"days":[],"note":null}'::jsonb NOT NULL,
	"phone" varchar,
	"website" varchar,
	"socials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"last_verified_at" timestamp(3) with time zone,
	"osm_id" varchar,
	"seo_title" varchar,
	"seo_description" varchar,
	"noindex" boolean DEFAULT false NOT NULL,
	"updated_by" varchar,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug"),
	CONSTRAINT "venues_osm_id_unique" UNIQUE("osm_id"),
	CONSTRAINT "venues_price_level_check" CHECK ("price_level" is null or "price_level" between 1 and 4),
	CONSTRAINT "venues_avg_check_check" CHECK ("avg_check" is null or "avg_check" >= 0),
	CONSTRAINT "venues_status_check" CHECK ("status" in ('draft', 'published', 'closed', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "venue_media" (
	"id" varchar PRIMARY KEY NOT NULL,
	"venue_id" varchar NOT NULL,
	"media_id" varchar NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_listing_intros" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"region_id" varchar,
	"kind" varchar,
	"body" text DEFAULT '' NOT NULL,
	"seo_title" varchar,
	"seo_description" varchar
);
--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "venue_media" ADD CONSTRAINT "venue_media_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "venue_media" ADD CONSTRAINT "venue_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "venue_listing_intros" ADD CONSTRAINT "venue_listing_intros_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "venue_id" varchar;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "analytics_hits" ADD COLUMN "venue_id" varchar;--> statement-breakpoint
CREATE INDEX "venues_status_idx" ON "venues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venues_kind_idx" ON "venues" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "venues_region_idx" ON "venues" USING btree ("region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_media_venue_media" ON "venue_media" USING btree ("venue_id","media_id");--> statement-breakpoint
CREATE INDEX "venue_media_venue_idx" ON "venue_media" USING btree ("venue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_listing_intros_slot" ON "venue_listing_intros" USING btree ((coalesce("region_id", '')), (coalesce("kind", '')));--> statement-breakpoint
CREATE INDEX "analytics_hits_venue_idx" ON "analytics_hits" USING btree ("venue_id","occurred_at");
