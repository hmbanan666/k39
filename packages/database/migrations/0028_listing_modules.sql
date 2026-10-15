ALTER TABLE "venue_listing_intros" ADD COLUMN IF NOT EXISTS "modules" jsonb DEFAULT '[]'::jsonb NOT NULL;
