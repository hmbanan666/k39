CREATE TABLE "mcp_audits" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"actor" varchar DEFAULT 'mcp' NOT NULL,
	"tool" varchar NOT NULL,
	"entity_type" varchar,
	"entity_id" varchar
);
