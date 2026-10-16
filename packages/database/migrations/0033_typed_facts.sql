CREATE TABLE "facts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"kind" varchar NOT NULL,
	"subject_type" varchar NOT NULL,
	"subject_id" varchar NOT NULL,
	"slot" varchar NOT NULL,
	"value" jsonb NOT NULL,
	"value_hash" varchar NOT NULL,
	"source_url" varchar,
	"source_title" varchar,
	"source_kind" varchar NOT NULL,
	"checked_at" timestamp(3) with time zone,
	"ttl_days" integer NOT NULL,
	"confidence" varchar NOT NULL,
	"retired_at" timestamp(3) with time zone,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facts_kind_check" CHECK ("kind" in ('hours', 'price', 'phone', 'address', 'coordinates', 'status')),
	CONSTRAINT "facts_subject_check" CHECK ("subject_type" in ('place', 'venue', 'route', 'route_stop', 'region')),
	CONSTRAINT "facts_source_check" CHECK ("source_kind" in ('official', 'official_social', 'map_yandex', 'map_2gis', 'osm', 'owner', 'none')),
	CONSTRAINT "facts_confidence_check" CHECK ("confidence" in ('stated', 'owner', 'gap')),
	CONSTRAINT "facts_ttl_check" CHECK ("ttl_days" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "facts_live_key_idx" ON "facts" USING btree ("kind","subject_type","subject_id","slot") WHERE "retired_at" is null;--> statement-breakpoint
CREATE INDEX "facts_kind_checked_idx" ON "facts" USING btree ("kind","checked_at");--> statement-breakpoint
CREATE TABLE "fact_revisions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"fact_id" varchar NOT NULL,
	"recorded_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"value" jsonb NOT NULL,
	"value_hash" varchar NOT NULL,
	"source_url" varchar,
	"source_title" varchar,
	"source_kind" varchar NOT NULL,
	"checked_at" timestamp(3) with time zone,
	"confidence" varchar NOT NULL,
	"actor" varchar NOT NULL,
	CONSTRAINT "fact_revisions_actor_check" CHECK ("actor" in ('migration', 'editor', 'owner', 'mcp')),
	CONSTRAINT "fact_revisions_confidence_check" CHECK ("confidence" in ('stated', 'owner', 'gap'))
);
--> statement-breakpoint
ALTER TABLE "fact_revisions" ADD CONSTRAINT "fact_revisions_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "fact_revisions_fact_recorded_idx" ON "fact_revisions" USING btree ("fact_id","recorded_at" DESC);--> statement-breakpoint
CREATE TABLE "fact_refs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"fact_id" varchar NOT NULL,
	"consumer_type" varchar NOT NULL,
	"consumer_id" varchar NOT NULL,
	"path" varchar NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fact_refs" ADD CONSTRAINT "fact_refs_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "fact_refs_unique" ON "fact_refs" USING btree ("fact_id","consumer_type","consumer_id","path");--> statement-breakpoint
CREATE INDEX "fact_refs_consumer_idx" ON "fact_refs" USING btree ("consumer_type","consumer_id");--> statement-breakpoint
CREATE INDEX "fact_refs_fact_idx" ON "fact_refs" USING btree ("fact_id");--> statement-breakpoint
CREATE TABLE "source_documents" (
	"url" varchar PRIMARY KEY NOT NULL,
	"content_hash" varchar,
	"etag" varchar,
	"last_modified" varchar,
	"http_status" integer,
	"fetched_at" timestamp(3) with time zone,
	"next_fetch_at" timestamp(3) with time zone,
	"fail_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "source_documents_next_fetch_idx" ON "source_documents" USING btree ("next_fetch_at");--> statement-breakpoint
CREATE TABLE "page_reviews" (
	"id" varchar PRIMARY KEY NOT NULL,
	"page_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"reviewed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"reviewer" varchar NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "page_reviews_page_idx" ON "page_reviews" USING btree ("page_type","entity_id");--> statement-breakpoint
CREATE TABLE "verification_queue" (
	"id" varchar PRIMARY KEY NOT NULL,
	"target" varchar NOT NULL,
	"fact_id" varchar,
	"page_type" varchar,
	"entity_id" varchar,
	"path" varchar,
	"reason" varchar NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enqueued_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"locked_by" varchar,
	"locked_until" timestamp(3) with time zone,
	"resolved_at" timestamp(3) with time zone,
	"proposal" jsonb,
	CONSTRAINT "verification_queue_target_check" CHECK ("target" in ('fact', 'section')),
	CONSTRAINT "verification_queue_reason_check" CHECK ("reason" in ('source_changed', 'ttl_expired', 'fetch_failed', 'source_gone', 'season_boundary', 'section_changed', 'unseeded', 'owner_conflict'))
);
--> statement-breakpoint
ALTER TABLE "verification_queue" ADD CONSTRAINT "verification_queue_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "verification_queue_open_idx" ON "verification_queue" USING btree ("priority" DESC,"enqueued_at") WHERE "resolved_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_queue_fact_open_idx" ON "verification_queue" USING btree ("fact_id","reason") WHERE "resolved_at" is null and "target" = 'fact';--> statement-breakpoint
CREATE UNIQUE INDEX "verification_queue_section_open_idx" ON "verification_queue" USING btree ("page_type","entity_id","path","reason") WHERE "resolved_at" is null and "target" = 'section';
