ALTER TABLE "venues" ADD COLUMN "booking_url" varchar;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "order_url" varchar;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "delivery_url" varchar;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "menu_url" varchar;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "reservation" varchar;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "takeaway" boolean;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "delivery" boolean;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "signature_dishes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_reservation_check" CHECK ("reservation" is null or "reservation" in ('yes', 'no', 'required', 'recommended'));--> statement-breakpoint
ALTER TABLE "venue_media" ADD COLUMN "origin" varchar;--> statement-breakpoint
ALTER TABLE "venue_media" ADD CONSTRAINT "venue_media_origin_check" CHECK ("origin" is null or "origin" in ('own', 'venue', 'commons'));
