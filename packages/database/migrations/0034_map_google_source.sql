ALTER TABLE "facts" DROP CONSTRAINT "facts_source_check";--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_source_check" CHECK ("source_kind" in ('official', 'official_social', 'map_yandex', 'map_2gis', 'map_google', 'osm', 'owner', 'none'));--> statement-breakpoint
ALTER TABLE "verification_queue" DROP CONSTRAINT "verification_queue_reason_check";--> statement-breakpoint
ALTER TABLE "verification_queue" ADD CONSTRAINT "verification_queue_reason_check" CHECK ("reason" in ('source_changed', 'ttl_expired', 'fetch_failed', 'source_gone', 'season_boundary', 'section_changed', 'unseeded', 'owner_conflict', 'fact_repeated'));
