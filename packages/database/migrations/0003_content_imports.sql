CREATE TABLE "content_imports" (
	"id" varchar PRIMARY KEY NOT NULL,
	"applied_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
