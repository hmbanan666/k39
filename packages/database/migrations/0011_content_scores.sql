CREATE TABLE "page_passports" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"page_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"path" varchar NOT NULL,
	"target_queries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audience" text,
	"primary_action" varchar,
	"goal_30d" integer,
	"goal_90d" integer,
	"notes" text,
	CONSTRAINT "page_passports_page_idx" UNIQUE("page_type","entity_id"),
	CONSTRAINT "page_passports_path_idx" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "content_scores" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"computed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"page_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"path" varchar NOT NULL,
	"title" varchar NOT NULL,
	"total" integer NOT NULL,
	"quality" integer NOT NULL,
	"linking" integer NOT NULL,
	"indexing" integer NOT NULL,
	"results" integer NOT NULL,
	"checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "content_scores_page_idx" UNIQUE("page_type","entity_id")
);
--> statement-breakpoint
CREATE INDEX "content_scores_path_idx" ON "content_scores" USING btree ("path");
--> statement-breakpoint
CREATE TABLE "content_score_days" (
	"day" date NOT NULL,
	"page_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"path" varchar NOT NULL,
	"title" varchar NOT NULL,
	"total" integer NOT NULL,
	"quality" integer NOT NULL,
	"linking" integer NOT NULL,
	"indexing" integer NOT NULL,
	"results" integer NOT NULL,
	"organic_30d" integer DEFAULT 0 NOT NULL,
	"organic_90d" integer DEFAULT 0 NOT NULL,
	"goal_30d" integer,
	"goal_90d" integer,
	CONSTRAINT "content_score_days_pk" PRIMARY KEY("day","page_type","entity_id")
);
