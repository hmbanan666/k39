CREATE TABLE "venues" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"slug" varchar NOT NULL,
	"name" varchar NOT NULL,
	"kind" varchar NOT NULL,
	"cuisine" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"region_id" varchar(24),
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"price_level" integer,
	"avg_check" integer,
	"hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"phone" varchar,
	"website" varchar,
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"last_verified_at" timestamp(3) with time zone,
	"osm_id" varchar,
	"seo_title" varchar,
	"seo_description" varchar,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug"),
	CONSTRAINT "venues_price_level" CHECK ("price_level" is null or "price_level" between 1 and 4),
	CONSTRAINT "venues_avg_check" CHECK ("avg_check" is null or "avg_check" >= 0),
	CONSTRAINT "venues_kind" CHECK ("kind" in ('cafe', 'restaurant', 'coffee', 'bar', 'bakery', 'market', 'fastfood', 'other')),
	CONSTRAINT "venues_status" CHECK ("status" in ('draft', 'published', 'closed', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "venues_osm_id_unique" ON "venues" USING btree ("osm_id");
--> statement-breakpoint
CREATE INDEX "venues_status_idx" ON "venues" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "venues_region_idx" ON "venues" USING btree ("region_id");
--> statement-breakpoint
CREATE INDEX "venues_kind_idx" ON "venues" USING btree ("kind");
--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
CREATE TABLE "venue_media" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"venue_id" varchar(24) NOT NULL,
	"media_id" varchar(24) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_media" ADD CONSTRAINT "venue_media_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "venue_media" ADD CONSTRAINT "venue_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "venue_media_venue_media" ON "venue_media" USING btree ("venue_id","media_id");
--> statement-breakpoint
CREATE INDEX "venue_media_venue_idx" ON "venue_media" USING btree ("venue_id");
--> statement-breakpoint
CREATE TABLE "venue_listing_intros" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"region_slug" varchar DEFAULT '' NOT NULL,
	"kind_slug" varchar DEFAULT '' NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	CONSTRAINT "venue_listing_intros_key" UNIQUE("region_slug","kind_slug")
);
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "venue_id" varchar(24);
--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "offers_venue_idx" ON "offers" USING btree ("venue_id");
