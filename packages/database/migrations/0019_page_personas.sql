CREATE TABLE "page_personas" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"page_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"persona_code" varchar NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "page_personas_page_persona_idx" ON "page_personas" ("page_type","entity_id","persona_code");--> statement-breakpoint
CREATE UNIQUE INDEX "page_personas_primary_idx" ON "page_personas" ("page_type","entity_id") WHERE "primary";
