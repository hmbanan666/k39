ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "modules" jsonb DEFAULT '[]'::jsonb NOT NULL;
