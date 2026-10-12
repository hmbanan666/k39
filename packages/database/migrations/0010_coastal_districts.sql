-- Optional center for a region. Both columns stay null until an editor sets them.
ALTER TABLE "regions" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "longitude" double precision;--> statement-breakpoint
-- Official district names for the four coastal and northern municipalities.
INSERT INTO "regions" ("id", "slug", "title")
VALUES
  ('region-zelenogradsk', 'zelenogradsk', 'Зеленоградский муниципальный округ'),
  ('region-svetlogorsk', 'svetlogorsk', 'Светлогорский городской округ'),
  ('region-baltiysk', 'baltiysk', 'Балтийский городской округ'),
  ('region-sovetsk', 'sovetsk', 'Советский городской округ')
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "updated_at" = now();
