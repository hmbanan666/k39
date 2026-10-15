ALTER TABLE "venues" ADD COLUMN "contact_email" varchar;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "venue_id" varchar;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_venue_idx" ON "businesses" USING btree ("venue_id") WHERE "venue_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "venue_members" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"venue_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	CONSTRAINT "venue_members_role_check" CHECK ("role" in ('owner', 'editor'))
);--> statement-breakpoint
ALTER TABLE "venue_members" ADD CONSTRAINT "venue_members_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "venue_members" ADD CONSTRAINT "venue_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_members_venue_user_idx" ON "venue_members" USING btree ("venue_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_members_one_owner_idx" ON "venue_members" USING btree ("venue_id") WHERE "role" = 'owner';--> statement-breakpoint
CREATE INDEX "venue_members_user_idx" ON "venue_members" USING btree ("user_id");--> statement-breakpoint
CREATE TABLE "venue_claims" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"venue_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"channel" varchar NOT NULL,
	"destination" varchar,
	"code_hash" varchar,
	"code_expires_at" timestamp(3) with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"evidence" text,
	"decided_at" timestamp(3) with time zone,
	"decided_by" varchar,
	CONSTRAINT "venue_claims_status_check" CHECK ("status" in ('pending', 'verified', 'rejected', 'withdrawn')),
	CONSTRAINT "venue_claims_channel_check" CHECK ("channel" in ('email', 'phone', 'manual'))
);--> statement-breakpoint
ALTER TABLE "venue_claims" ADD CONSTRAINT "venue_claims_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD CONSTRAINT "venue_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD CONSTRAINT "venue_claims_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_claims_open_idx" ON "venue_claims" USING btree ("venue_id","user_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "venue_claims_status_idx" ON "venue_claims" USING btree ("status","created_at");--> statement-breakpoint
CREATE TABLE "venue_audits" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"venue_id" varchar NOT NULL,
	"actor_user_id" varchar,
	"action" varchar NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL
);--> statement-breakpoint
ALTER TABLE "venue_audits" ADD CONSTRAINT "venue_audits_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "venue_audits" ADD CONSTRAINT "venue_audits_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "venue_audits_venue_idx" ON "venue_audits" USING btree ("venue_id","created_at");
