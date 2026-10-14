ALTER TABLE "regions" ADD COLUMN "short_title" varchar;--> statement-breakpoint
-- Eyebrows and filters use the town name, not the official district name.
UPDATE "regions" SET "short_title" = CASE "slug"
  WHEN 'zelenogradsk' THEN 'Зеленоградск'
  WHEN 'svetlogorsk' THEN 'Светлогорск'
  WHEN 'baltiysk' THEN 'Балтийск'
  WHEN 'sovetsk' THEN 'Советск'
  WHEN 'yantarnyy' THEN 'Янтарный'
END
WHERE "slug" IN ('zelenogradsk', 'svetlogorsk', 'baltiysk', 'sovetsk', 'yantarnyy') AND "short_title" IS NULL;
