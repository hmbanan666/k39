ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "modules" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"category" varchar NOT NULL,
	"default_variant" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "venue_prices" (
	"id" varchar PRIMARY KEY NOT NULL,
	"venue_id" varchar NOT NULL REFERENCES "venues"("id") ON DELETE cascade ON UPDATE cascade,
	"item_id" varchar NOT NULL REFERENCES "price_items"("id") ON DELETE cascade ON UPDATE cascade,
	"variant" varchar DEFAULT '' NOT NULL,
	"price_rub" integer NOT NULL,
	"checked_at" date NOT NULL,
	"source_kind" varchar NOT NULL,
	"source_title" varchar NOT NULL,
	"source_url" varchar,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_prices_price_check" CHECK ("price_rub" > 0),
	CONSTRAINT "venue_prices_source_check" CHECK ("source_kind" in ('official', 'owner'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "venue_prices_venue_item_variant" ON "venue_prices" ("venue_id", "item_id", "variant");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_prices_item_idx" ON "venue_prices" ("item_id");
--> statement-breakpoint
INSERT INTO "price_items" ("id", "slug", "title", "category", "default_variant", "sort_order") VALUES
	('pi0cappuccino00000000000', 'cappuccino', 'Капучино', 'coffee', '300 мл', 10),
	('pi0americano000000000000', 'americano', 'Американо', 'coffee', '300 мл', 20),
	('pi0margherita00000000000', 'margherita', 'Пицца «Маргарита»', 'pizza', '30 см', 30),
	('pi0philadelphia000000000', 'philadelphia', 'Ролл «Филадельфия»', 'sushi', '8 шт.', 40),
	('pi0borscht00000000000000', 'borscht', 'Борщ', 'soup', 'порция', 50),
	('pi0burger000000000000000', 'burger', 'Бургер', 'burger', 'классический', 60)
ON CONFLICT ("slug") DO NOTHING;
