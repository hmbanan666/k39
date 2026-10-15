ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "price_band" varchar;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "price_band_computed_at" timestamp(3) with time zone;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "price_band_basis" integer;
ALTER TABLE "venues" ADD CONSTRAINT "venues_price_band_check" CHECK ("price_band" is null or "price_band" in ('low', 'mid', 'high'));
ALTER TABLE "venues" ADD CONSTRAINT "venues_price_band_basis_check" CHECK ("price_band_basis" is null or "price_band_basis" >= 0);
CREATE INDEX IF NOT EXISTS "venues_price_band_idx" ON "venues" ("region_id", "price_band");
