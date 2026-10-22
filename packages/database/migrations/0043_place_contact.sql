-- Official place phone and website (#238), and an explicit schema.org subtype (#239).
-- The phone text is a copy of the `phone` fact, the same as `venues.phone`.
-- The subtype allowlist lives in code (`PLACE_SCHEMA_TYPES`), so there is no check constraint.
-- No backfill: live pages get values later through the content writer.

ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "phone" varchar;
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "website" varchar;
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "schema_type" varchar;
