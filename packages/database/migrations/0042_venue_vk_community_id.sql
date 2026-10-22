-- ADR 0047: the numeric id of the VK community that socials link by screen
-- name. Album, photo, wall, and market URLs carry only that id. Null until an
-- editor declares it; a club, public, or event link already carries it.
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "vk_community_id" bigint;
--> statement-breakpoint
ALTER TABLE "venues" DROP CONSTRAINT IF EXISTS "venues_vk_community_id_check";
--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_vk_community_id_check" CHECK ("venues"."vk_community_id" is null or "venues"."vk_community_id" > 0);
