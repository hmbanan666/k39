# Migration registry

The next number is one higher than the highest prefix on `origin/main` after `git fetch`. Drizzle snapshots stop at `0003`. Later files are hand-written SQL, so `pnpm --filter @k39/database db:generate` does not choose the number.

Add the row in the same commit as the SQL file. A `reserved` row holds a number that has no SQL file yet, so another branch does not take it. Merge that reservation to `main` before the migration that uses it. CI rejects a duplicate prefix, a SQL file missing from this list, and a list row whose file is missing.

| Prefix | File | Status |
| --- | --- | --- |
| 0000 | 0000_perfect_nova.sql | applied |
| 0001 | 0001_content_admin.sql | applied |
| 0002 | 0002_seo_og_image.sql | applied |
| 0003 | 0003_content_imports.sql | applied |
| 0004 | 0004_media_pipeline.sql | applied |
| 0005 | 0005_mcp_audits.sql | applied |
| 0006 | 0006_castle_regions.sql | applied |
| 0007 | 0007_analytics.sql | applied |
| 0008 | 0008_user_consents.sql | applied |
| 0009 | 0009_point_notes.sql | applied |
| 0010 | 0010_coastal_districts.sql | applied |
| 0011 | 0011_content_scores.sql | applied |
| 0012 | 0012_hub_body.sql | applied |
| 0013 | 0013_venues.sql | applied |
| 0014 | 0014_route_path.sql | applied |
| 0015 | 0015_place_guide.sql | applied |
| 0016 | 0016_month_guides.sql | applied |
| 0017 | 0017_collection_media.sql | applied |
| 0018 | 0018_page_modules.sql | applied |
| 0019 | 0019_page_personas.sql | applied |
| 0020 | 0020_body_sections.sql | applied |
| 0021 | 0021_schedules.sql | applied |
| 0022 | 0022_venue_schedule_verified.sql | applied |
| 0023 | 0023_venue_actions.sql | applied |
| 0024 | 0024_region_short_title.sql | applied |
| 0025 | 0025_site_search.sql | applied |
| 0026 | 0026_venue_modules.sql | applied |
| 0027 | 0027_venue_claims.sql | applied |
| 0028 | 0028_listing_modules.sql | applied |
| 0029 | 0029_dish_showcase.sql | applied |
| 0030 | 0030_price_item_image.sql | applied |
| 0031 | 0031_venue_price_band.sql | applied |
| 0032 | 0032_length_override.sql | applied |
| 0033 | 0033_typed_facts.sql | applied |
| 0034 | 0034_map_google_source.sql | applied |
| 0035 | 0035_content_drafts.sql | applied |
| 0036 | 0036_unsourced_gap_facts.sql | applied |
| 0037 | 0037_consent_method.sql | applied |
| 0038 | 0038_guest_submissions.sql | applied |
| 0039 | 0039_search_fold.sql | applied |
| 0040 | 0040_open_ended_intervals.sql | applied |
| 0041 | 0041_first_published_at.sql | applied |
| 0042 | 0042_venue_vk_community_id.sql | applied |
| 0043 | 0043_place_contact.sql | applied |
| 0044 | 0044_admission_events.sql | applied |
| 0045 | 0045_notices.sql | applied |
