-- First publication, for the goal window in ADR 0045.
-- The publish path sets the column from now on and does not move it.
-- Rows that are already published take the earliest revision whose
-- snapshot says published, then the latest revision whose snapshot does
-- not (publishing a draft stores that draft), then created_at.
-- Hubs have no separate publish step, so categories use created_at.
-- This is schema backfill. It does not edit article text.

ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "first_published_at" timestamp(3) with time zone;
--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "first_published_at" timestamp(3) with time zone;
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "first_published_at" timestamp(3) with time zone;
--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "first_published_at" timestamp(3) with time zone;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "first_published_at" timestamp(3) with time zone;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "first_published_at" timestamp(3) with time zone;
--> statement-breakpoint
UPDATE places AS p
SET first_published_at = COALESCE(
  (
    SELECT MIN(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'place'
      AND r.entity_id = p.id
      AND COALESCE(r.snapshot->>'publicationStatus', r.snapshot->>'publication_status') = 'published'
  ),
  (
    SELECT MAX(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'place'
      AND r.entity_id = p.id
      AND COALESCE(r.snapshot->>'publicationStatus', r.snapshot->>'publication_status') IS DISTINCT FROM 'published'
  ),
  p.created_at
)
WHERE p.publication_status = 'published'
  AND p.first_published_at IS NULL;
--> statement-breakpoint
UPDATE routes AS published_row
SET first_published_at = COALESCE(
  (
    SELECT MIN(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'route'
      AND r.entity_id = published_row.id
      AND COALESCE(r.snapshot->>'publicationStatus', r.snapshot->>'publication_status') = 'published'
  ),
  (
    SELECT MAX(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'route'
      AND r.entity_id = published_row.id
      AND COALESCE(r.snapshot->>'publicationStatus', r.snapshot->>'publication_status') IS DISTINCT FROM 'published'
  ),
  published_row.created_at
)
WHERE published_row.publication_status = 'published'
  AND published_row.first_published_at IS NULL;
--> statement-breakpoint
UPDATE collections AS published_row
SET first_published_at = COALESCE(
  (
    SELECT MIN(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'collection'
      AND r.entity_id = published_row.id
      AND COALESCE(r.snapshot->>'publicationStatus', r.snapshot->>'publication_status') = 'published'
  ),
  (
    SELECT MAX(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'collection'
      AND r.entity_id = published_row.id
      AND COALESCE(r.snapshot->>'publicationStatus', r.snapshot->>'publication_status') IS DISTINCT FROM 'published'
  ),
  published_row.created_at
)
WHERE published_row.publication_status = 'published'
  AND published_row.first_published_at IS NULL;
--> statement-breakpoint
UPDATE quests AS published_row
SET first_published_at = COALESCE(
  (
    SELECT MIN(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'quest'
      AND r.entity_id = published_row.id
      AND COALESCE(r.snapshot->>'publicationStatus', r.snapshot->>'publication_status') = 'published'
  ),
  (
    SELECT MAX(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'quest'
      AND r.entity_id = published_row.id
      AND COALESCE(r.snapshot->>'publicationStatus', r.snapshot->>'publication_status') IS DISTINCT FROM 'published'
  ),
  published_row.created_at
)
WHERE published_row.publication_status = 'published'
  AND published_row.first_published_at IS NULL;
--> statement-breakpoint
UPDATE venues AS published_row
SET first_published_at = COALESCE(
  (
    SELECT MIN(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'venue'
      AND r.entity_id = published_row.id
      AND COALESCE(r.snapshot->>'status', '') = 'published'
  ),
  (
    SELECT MAX(r.created_at)
    FROM revisions AS r
    WHERE r.entity_type = 'venue'
      AND r.entity_id = published_row.id
      AND COALESCE(r.snapshot->>'status', '') IS DISTINCT FROM 'published'
  ),
  published_row.created_at
)
WHERE published_row.status = 'published'
  AND published_row.first_published_at IS NULL;
--> statement-breakpoint
UPDATE categories
SET first_published_at = created_at
WHERE first_published_at IS NULL;
