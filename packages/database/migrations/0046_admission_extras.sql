-- Existing rows remain entry tickets; no fact value, source or date is rewritten.
ALTER TABLE admission_prices ADD COLUMN kind varchar NOT NULL DEFAULT 'entry';
--> statement-breakpoint
ALTER TABLE admission_prices ADD COLUMN unit varchar;
--> statement-breakpoint
ALTER TABLE admission_prices ALTER COLUMN audience DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE admission_prices DROP CONSTRAINT admission_prices_audience_check;
--> statement-breakpoint
ALTER TABLE admission_prices DROP CONSTRAINT admission_prices_price_check;
--> statement-breakpoint
ALTER TABLE admission_prices ADD CONSTRAINT admission_prices_shape_check CHECK (
  (kind = 'entry' AND audience IS NOT NULL
    AND audience IN ('general', 'reduced', 'family', 'foreign', 'free') AND unit IS NULL
    AND ((audience = 'free' AND price_rub = 0) OR (audience <> 'free' AND price_rub > 0)))
  OR (kind = 'extra' AND audience IS NULL AND price_rub > 0
    AND label IS NOT NULL AND length(trim(label)) > 0
    AND (unit IS NULL OR unit IN ('person', 'group', 'device')))
);
--> statement-breakpoint
DROP INDEX admission_prices_subject_slot;
--> statement-breakpoint
CREATE UNIQUE INDEX admission_prices_subject_slot ON admission_prices (subject_type, subject_id, kind, slot);
