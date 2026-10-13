ALTER TABLE "collections" ADD COLUMN "modules" jsonb DEFAULT '[]'::jsonb NOT NULL;
