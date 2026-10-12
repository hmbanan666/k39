CREATE TABLE "user_consents" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"user_id" varchar(24) NOT NULL,
	"version" varchar NOT NULL,
	"consented_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"method" varchar NOT NULL,
	"withdrawn_at" timestamp(3) with time zone
);
--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "user_consents_user_idx" ON "user_consents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_consents_active_idx" ON "user_consents" USING btree ("user_id","version") WHERE "withdrawn_at" IS NULL;
