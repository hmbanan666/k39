CREATE TABLE "businesses" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"slug" varchar NOT NULL,
	"name" varchar NOT NULL,
	"contact_email" varchar,
	"owner_user_id" varchar(24),
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"occurred_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"type" varchar NOT NULL,
	"place_id" varchar(24),
	"place_slug" varchar,
	"route_slug" varchar,
	"quest_slug" varchar,
	"session_id" varchar NOT NULL,
	"consent" boolean NOT NULL,
	CONSTRAINT "events_consent_required" CHECK ("events"."consent" = true)
);
--> statement-breakpoint
CREATE TABLE "offer_codes" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"offer_id" varchar(24) NOT NULL,
	"code" varchar NOT NULL,
	"status" varchar DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"redeemed_at" timestamp(3) with time zone,
	"session_id" varchar,
	CONSTRAINT "offer_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"business_id" varchar(24) NOT NULL,
	"place_id" varchar(24),
	"route_id" varchar(24),
	"title" varchar NOT NULL,
	"terms" text NOT NULL,
	"kind" varchar DEFAULT 'discount' NOT NULL,
	"bid" integer,
	"budget" integer,
	"spent" integer DEFAULT 0 NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"type" varchar NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"status" varchar DEFAULT 'unknown' NOT NULL,
	"hours" varchar,
	"source_url" varchar,
	"region_id" varchar(24),
	CONSTRAINT "places_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "quest_steps" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"quest_id" varchar(24) NOT NULL,
	"place_id" varchar(24) NOT NULL,
	"position" integer NOT NULL,
	"title" varchar NOT NULL,
	"prompt" text
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"summary" text,
	"route_id" varchar(24),
	CONSTRAINT "quests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	CONSTRAINT "regions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "route_points" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"route_id" varchar(24) NOT NULL,
	"place_id" varchar(24) NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"summary" text,
	"region_id" varchar(24),
	CONSTRAINT "routes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"email" varchar NOT NULL,
	"name" varchar NOT NULL,
	"avatar_url" varchar,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "offer_codes" ADD CONSTRAINT "offer_codes_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quest_steps" ADD CONSTRAINT "quest_steps_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quest_steps" ADD CONSTRAINT "quest_steps_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "route_points" ADD CONSTRAINT "route_points_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "route_points" ADD CONSTRAINT "route_points_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "events_occurred_at_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "events_place_slug_idx" ON "events" USING btree ("place_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "quest_steps_quest_position" ON "quest_steps" USING btree ("quest_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "route_points_route_position" ON "route_points" USING btree ("route_id","position");