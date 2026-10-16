ALTER TABLE "verification_queue" DROP CONSTRAINT "verification_queue_reason_check";--> statement-breakpoint
ALTER TABLE "verification_queue" ADD CONSTRAINT "verification_queue_reason_check" CHECK ("reason" in ('source_changed', 'ttl_expired', 'fetch_failed', 'source_gone', 'season_boundary', 'section_changed', 'unseeded', 'owner_conflict', 'fact_repeated', 'guest_report'));--> statement-breakpoint
CREATE TABLE "guest_submissions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"user_id" varchar(24) NOT NULL,
	"subject_type" varchar NOT NULL,
	"subject_id" varchar NOT NULL,
	"kind" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"body" text,
	"alt" varchar,
	"correction_kind" varchar,
	"correction_value" varchar,
	"source_url" varchar,
	"media_id" varchar(24),
	"decided_by" varchar(24),
	"decided_at" timestamp(3) with time zone,
	"decision_note" text,
	"disputed" boolean DEFAULT false NOT NULL,
	"body_key" varchar,
	CONSTRAINT "guest_submissions_subject_check" CHECK ("subject_type" in ('place', 'venue')),
	CONSTRAINT "guest_submissions_kind_check" CHECK ("kind" in ('review', 'tip', 'photo', 'correction')),
	CONSTRAINT "guest_submissions_status_check" CHECK ("status" in ('pending', 'accepted', 'rejected', 'removed')),
	CONSTRAINT "guest_submissions_correction_check" CHECK ("correction_kind" is null or "correction_kind" in ('hours', 'phone', 'address', 'status', 'price', 'other'))
);--> statement-breakpoint
ALTER TABLE "guest_submissions" ADD CONSTRAINT "guest_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "guest_submissions" ADD CONSTRAINT "guest_submissions_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "guest_submissions" ADD CONSTRAINT "guest_submissions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "guest_submissions_pending_idx" ON "guest_submissions" USING btree ("user_id","subject_type","subject_id","kind") WHERE "status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "guest_submissions_accepted_review_idx" ON "guest_submissions" USING btree ("user_id","subject_type","subject_id") WHERE "status" = 'accepted' AND "kind" = 'review';--> statement-breakpoint
CREATE UNIQUE INDEX "guest_submissions_accepted_tip_idx" ON "guest_submissions" USING btree ("user_id","subject_type","subject_id") WHERE "status" = 'accepted' AND "kind" = 'tip';--> statement-breakpoint
CREATE UNIQUE INDEX "guest_submissions_body_idx" ON "guest_submissions" USING btree ("subject_type","subject_id","kind","body_key") WHERE "status" in ('pending', 'accepted') AND "body_key" is not null;--> statement-breakpoint
CREATE INDEX "guest_submissions_public_idx" ON "guest_submissions" USING btree ("subject_type","subject_id","decided_at" DESC) WHERE "status" = 'accepted';--> statement-breakpoint
CREATE INDEX "guest_submissions_queue_idx" ON "guest_submissions" USING btree ("created_at") WHERE "status" = 'pending';--> statement-breakpoint
CREATE TABLE "guest_audits" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"submission_id" varchar NOT NULL,
	"actor_user_id" varchar(24),
	"action" varchar NOT NULL
);--> statement-breakpoint
ALTER TABLE "guest_audits" ADD CONSTRAINT "guest_audits_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "guest_audits_submission_idx" ON "guest_audits" USING btree ("submission_id","created_at");
