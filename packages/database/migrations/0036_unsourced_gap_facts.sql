-- A gap is the explicit unknown, not a copy of an unsourced column.
-- Phone, address, and coordinates with no source are removed so the reader
-- falls back to the column. Non-empty hours with no source are removed too.
-- Empty hours stay: that row is the explicit unknown.
DELETE FROM "facts"
WHERE "retired_at" IS NULL
  AND "confidence" = 'gap'
  AND "source_kind" = 'none'
  AND (
    "kind" IN ('phone', 'address', 'coordinates')
    OR (
      "kind" = 'hours'
      AND (
        coalesce("value"->>'mode', 'hours') <> 'hours'
        OR coalesce("value"->>'note', '') <> ''
        OR jsonb_array_length(coalesce("value"->'occurrences', '[]'::jsonb)) > 0
        OR jsonb_array_length(coalesce("value"->'exceptions', '[]'::jsonb)) > 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(coalesce("value"->'seasons', '[]'::jsonb)) AS season
          WHERE jsonb_array_length(coalesce(season->'week', '[]'::jsonb)) > 0
        )
      )
    )
  );
