CREATE TABLE "analytics_hits" (
	"id" varchar PRIMARY KEY NOT NULL,
	"occurred_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"visitor_key" varchar NOT NULL,
	"visitor_mode" varchar NOT NULL,
	"session_key" varchar NOT NULL,
	"consented" boolean DEFAULT false NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"event_type" varchar NOT NULL,
	"path" varchar NOT NULL,
	"place_id" varchar,
	"route_id" varchar,
	"referrer" varchar,
	"referrer_host" varchar,
	"utm_source" varchar,
	"utm_medium" varchar,
	"utm_campaign" varchar,
	"channel" varchar NOT NULL,
	"search_query" varchar,
	"device" varchar,
	"browser" varchar,
	"os" varchar,
	"screen_bucket" varchar,
	"language" varchar,
	"landing_path" varchar,
	"is_entry" boolean DEFAULT false NOT NULL,
	"is_exit" boolean DEFAULT false NOT NULL,
	"engaged_ms" integer,
	"scroll_bucket" varchar,
	"target" varchar
);--> statement-breakpoint
CREATE INDEX "analytics_hits_occurred_idx" ON "analytics_hits" ("occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_hits_session_idx" ON "analytics_hits" ("session_key", "occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_hits_visitor_idx" ON "analytics_hits" ("visitor_key", "occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_hits_path_idx" ON "analytics_hits" ("path", "occurred_at");--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"day" date NOT NULL,
	"path" varchar DEFAULT '' NOT NULL,
	"channel" varchar DEFAULT '' NOT NULL,
	"device" varchar DEFAULT '' NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"bounces" integer DEFAULT 0 NOT NULL,
	"engaged_ms" bigint DEFAULT 0 NOT NULL,
	"outbound" integer DEFAULT 0 NOT NULL,
	"photos" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_daily_pk" PRIMARY KEY("day","path","channel","device")
);--> statement-breakpoint
CREATE TABLE "analytics_search_queries" (
	"day" date NOT NULL,
	"engine" varchar NOT NULL,
	"page" varchar DEFAULT '' NOT NULL,
	"query" varchar NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"position" real,
	CONSTRAINT "analytics_search_queries_pk" PRIMARY KEY("day","engine","page","query")
);--> statement-breakpoint
CREATE TABLE "analytics_runs" (
	"day" date NOT NULL,
	"kind" varchar NOT NULL,
	CONSTRAINT "analytics_runs_pk" PRIMARY KEY("day","kind")
);
