-- ADR 0028 migrated venue hours without verified_at, so venues whose facts an
-- editor had already checked (venues.last_verified_at) read as unknown. Carry
-- that check date over to their schedules. OSM-only venues stay unverified.
UPDATE "schedules" AS s
SET "verified_at" = (v."last_verified_at" AT TIME ZONE 'Europe/Kaliningrad')::date,
    "updated_at" = now()
FROM "venues" AS v
WHERE s."entity_type" = 'venue'
  AND s."entity_id" = v."id"
  AND s."verified_at" IS NULL
  AND v."last_verified_at" IS NOT NULL
  AND coalesce((s."rules"->>'needsCheck')::boolean, false) = false;
