CREATE TABLE "categories" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"seo_title" varchar,
	"seo_description" varchar,
	"noindex" boolean DEFAULT false NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"collection_id" varchar(24) NOT NULL,
	"place_id" varchar(24) NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"summary" text,
	"body" text DEFAULT '' NOT NULL,
	"seo_title" varchar,
	"seo_description" varchar,
	"publication_status" varchar DEFAULT 'draft' NOT NULL,
	"noindex" boolean DEFAULT false NOT NULL,
	"updated_by" varchar(24),
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"filename" varchar NOT NULL,
	"mime" varchar NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"alt" varchar DEFAULT '' NOT NULL,
	"credit" varchar,
	"source_url" varchar,
	"place_id" varchar(24),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "related_links" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"from_place_id" varchar(24) NOT NULL,
	"to_place_id" varchar(24) NOT NULL,
	"anchor" varchar,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"snapshot" jsonb NOT NULL,
	"updated_by" varchar(24)
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"from_path" varchar NOT NULL,
	"to_path" varchar,
	"status_code" integer DEFAULT 301 NOT NULL,
	CONSTRAINT "slug_redirects_from_path_unique" UNIQUE("from_path")
);
--> statement-breakpoint
ALTER TABLE "places" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ALTER COLUMN "latitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ALTER COLUMN "longitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "category_id" varchar(24);--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "price" varchar;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "how_to_get" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "summary" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "body" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "last_verified_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "author_kind" varchar DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "seo_title" varchar;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "seo_description" varchar;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "publication_status" varchar DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "noindex" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "updated_by" varchar(24);--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "body" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "seo_title" varchar;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "seo_description" varchar;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "publication_status" varchar DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "noindex" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "updated_by" varchar(24);--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "body" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "seo_title" varchar;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "seo_description" varchar;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "publication_status" varchar DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "noindex" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "updated_by" varchar(24);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "related_links" ADD CONSTRAINT "related_links_from_place_id_places_id_fk" FOREIGN KEY ("from_place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "related_links" ADD CONSTRAINT "related_links_to_place_id_places_id_fk" FOREIGN KEY ("to_place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_position" ON "collection_items" USING btree ("collection_id","position");--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "places_publication_idx" ON "places" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "places_category_idx" ON "places" USING btree ("category_id");