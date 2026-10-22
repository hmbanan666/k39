import type { BodySection } from './body-sections'
import type { ClaimChannel, ClaimStatus, VenueMemberRole } from './claims'
import type { AuthorKind, CollectionKind, MediaLicense, MediaStatus, MediaVariant, OfferCodeStatus, OfferKind, OfferStatus, PageKind, PlaceFaqItem, PrimaryAction, PublicationStatus, SourceLink, StoredPageModule, UserRole, VisitStatus } from './types/entities'
import type { LengthOverride, ScoreChecks } from './types/scoring'
import type { VenueDish, VenueHours, VenuePhotoOrigin, VenueReservation, VenueSocial, VenueStatus } from './venues'
import { cuid2 } from 'drizzle-cuid2/postgres'
import { sql } from 'drizzle-orm'
import { bigint, boolean, check, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

function createdAt() {
  return timestamp('created_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow()
}

function updatedAt() {
  return timestamp('updated_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow()
}

export const users = pgTable('users', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  email: varchar('email').notNull().unique(),
  name: varchar('name').notNull(),
  avatarUrl: varchar('avatar_url'),
  role: varchar('role').notNull().default('user').$type<UserRole>(),
})

export const userConsents = pgTable('user_consents', {
  id: cuid2('id').defaultRandom().primaryKey(),
  userId: cuid2('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  version: varchar('version').notNull(),
  consentedAt: timestamp('consented_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  method: varchar('method').notNull(),
  withdrawnAt: timestamp('withdrawn_at', { precision: 3, withTimezone: true, mode: 'string' }),
}, (table) => [
  index('user_consents_user_idx').on(table.userId),
  uniqueIndex('user_consents_active_idx').on(table.userId, table.version).where(sql`${table.withdrawnAt} is null`),
])

export const regions = pgTable('regions', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  // Town name for eyebrows and filters («Зеленоградск» for the official
  // «Зеленоградский муниципальный округ»). Null: use title.
  shortTitle: varchar('short_title'),
  description: text('description'),
  // Optional map center. Both stay null until an editor sets them.
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
})

export const categories = pgTable('categories', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  body: text('body').notNull().default(''),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  ogImage: varchar('og_image'),
  noindex: boolean('noindex').notNull().default(false),
  // Hubs have no separate publish step. The migration copies created_at.
  firstPublishedAt: timestamp('first_published_at', { precision: 3, withTimezone: true, mode: 'string' }),
})

export const places = pgTable('places', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  // Kept so the baseline migration can add columns instead of renaming `type`.
  type: varchar('type'),
  sourceUrl: varchar('source_url'),
  categoryId: cuid2('category_id').references(() => categories.id, { onUpdate: 'cascade' }),
  regionId: cuid2('region_id').references(() => regions.id, { onUpdate: 'cascade' }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  status: varchar('status').notNull().default('unknown').$type<VisitStatus>(),
  hours: varchar('hours'),
  price: varchar('price'),
  // Copy of the `phone` fact text (ADR 0033), official sources only. Same max as `venues.phone`.
  phone: varchar('phone'),
  // The place's own official site. A social page or a map card is rejected by the writer.
  website: varchar('website'),
  // schema.org subtype from `PLACE_SCHEMA_TYPES`. Null falls back to the hub mapping.
  schemaType: varchar('schema_type'),
  howToGet: text('how_to_get'),
  summary: text('summary').notNull().default(''),
  body: text('body').notNull().default(''),
  // Typed body sections (ADR 0027); `body` is composed from them on save.
  sections: jsonb('sections').$type<BodySection[]>().notNull().default(sql`'[]'::jsonb`),
  sources: jsonb('sources').$type<SourceLink[]>().notNull().default(sql`'[]'::jsonb`),
  // Guide answer block (ADR 0020). Free text in Russian, each backed by a source.
  visitDuration: varchar('visit_duration'),
  bestTime: varchar('best_time'),
  faq: jsonb('faq').$type<PlaceFaqItem[]>().notNull().default(sql`'[]'::jsonb`),
  lastVerifiedAt: timestamp('last_verified_at', { precision: 3, withTimezone: true, mode: 'string' }),
  authorKind: varchar('author_kind').notNull().default('human').$type<AuthorKind>(),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  ogImage: varchar('og_image'),
  publicationStatus: varchar('publication_status').notNull().default('draft').$type<PublicationStatus>(),
  noindex: boolean('noindex').notNull().default(false),
  // Set on the first publish and kept. Goal windows read it (ADR 0045).
  firstPublishedAt: timestamp('first_published_at', { precision: 3, withTimezone: true, mode: 'string' }),
  updatedBy: cuid2('updated_by').references(() => users.id, { onUpdate: 'cascade', onDelete: 'set null' }),
}, (table) => [
  index('places_publication_idx').on(table.publicationStatus),
  index('places_category_idx').on(table.categoryId),
])

/** Agent write against a live place, route, or collection. The public page keeps reading the live row until an editor publishes. */
export const contentDrafts = pgTable('content_drafts', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  entityType: varchar('entity_type').notNull(),
  entityId: varchar('entity_id').notNull(),
  publicationStatus: varchar('publication_status').notNull().default('review').$type<'draft' | 'review'>(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
}, (table) => [
  uniqueIndex('content_drafts_entity_idx').on(table.entityType, table.entityId),
  check('content_drafts_status_check', sql`${table.publicationStatus} in ('draft', 'review')`),
])

export const media = pgTable('media', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  filename: varchar('filename').notNull(),
  mime: varchar('mime').notNull(),
  bytes: integer('bytes').notNull().default(0),
  width: integer('width'),
  height: integer('height'),
  alt: varchar('alt').notNull().default(''),
  credit: varchar('credit'),
  sourceUrl: varchar('source_url'),
  placeId: cuid2('place_id').references(() => places.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  status: varchar('status').notNull().default('ready').$type<MediaStatus>(),
  variants: jsonb('variants').$type<MediaVariant[]>().notNull().default(sql`'[]'::jsonb`),
  lqip: text('lqip'),
  dominantColor: varchar('dominant_color'),
  focalX: doublePrecision('focal_x').notNull().default(0.5),
  focalY: doublePrecision('focal_y').notNull().default(0.5),
  license: varchar('license').$type<MediaLicense | null>(),
  author: varchar('author'),
  caption: text('caption'),
})

export const placeMedia = pgTable('place_media', {
  id: cuid2('id').defaultRandom().primaryKey(),
  placeId: cuid2('place_id').notNull().references(() => places.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  mediaId: cuid2('media_id').notNull().references(() => media.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isCover: boolean('is_cover').notNull().default(false),
}, (table) => [
  uniqueIndex('place_media_place_media').on(table.placeId, table.mediaId),
  index('place_media_place_idx').on(table.placeId),
])

export const collectionMedia = pgTable('collection_media', {
  id: cuid2('id').defaultRandom().primaryKey(),
  collectionId: cuid2('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  mediaId: cuid2('media_id').notNull().references(() => media.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isCover: boolean('is_cover').notNull().default(false),
}, (table) => [
  uniqueIndex('collection_media_collection_media').on(table.collectionId, table.mediaId),
  index('collection_media_collection_idx').on(table.collectionId),
])

export const routes = pgTable('routes', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  summary: text('summary'),
  body: text('body').notNull().default(''),
  sections: jsonb('sections').$type<BodySection[]>().notNull().default(sql`'[]'::jsonb`),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  ogImage: varchar('og_image'),
  publicationStatus: varchar('publication_status').notNull().default('draft').$type<PublicationStatus>(),
  noindex: boolean('noindex').notNull().default(false),
  // Set on the first publish and kept. Goal windows read it (ADR 0045).
  firstPublishedAt: timestamp('first_published_at', { precision: 3, withTimezone: true, mode: 'string' }),
  updatedBy: cuid2('updated_by').references(() => users.id, { onUpdate: 'cascade', onDelete: 'set null' }),
  regionId: cuid2('region_id').references(() => regions.id, { onUpdate: 'cascade' }),
  // Optional real route geometry: [longitude, latitude] pairs. Null keeps the map on a dashed connector.
  path: jsonb('path').$type<[number, number][] | null>(),
})

export const routePoints = pgTable('route_points', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  routeId: cuid2('route_id').notNull().references(() => routes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  placeId: cuid2('place_id').notNull().references(() => places.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  position: integer('position').notNull(),
  note: text('note'),
}, (table) => [
  uniqueIndex('route_points_route_position').on(table.routeId, table.position),
])

export const quests = pgTable('quests', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  summary: text('summary'),
  body: text('body').notNull().default(''),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  ogImage: varchar('og_image'),
  publicationStatus: varchar('publication_status').notNull().default('draft').$type<PublicationStatus>(),
  noindex: boolean('noindex').notNull().default(false),
  // Set on the first publish and kept. Goal windows read it (ADR 0045).
  firstPublishedAt: timestamp('first_published_at', { precision: 3, withTimezone: true, mode: 'string' }),
  updatedBy: cuid2('updated_by').references(() => users.id, { onUpdate: 'cascade', onDelete: 'set null' }),
  routeId: cuid2('route_id').references(() => routes.id, { onUpdate: 'cascade' }),
})

export const questSteps = pgTable('quest_steps', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  questId: cuid2('quest_id').notNull().references(() => quests.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  placeId: cuid2('place_id').notNull().references(() => places.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  position: integer('position').notNull(),
  title: varchar('title').notNull(),
  prompt: text('prompt'),
}, (table) => [
  uniqueIndex('quest_steps_quest_position').on(table.questId, table.position),
])

export const collections = pgTable('collections', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  summary: text('summary'),
  body: text('body').notNull().default(''),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  ogImage: varchar('og_image'),
  publicationStatus: varchar('publication_status').notNull().default('draft').$type<PublicationStatus>(),
  noindex: boolean('noindex').notNull().default(false),
  // Set on the first publish and kept. Goal windows read it (ADR 0045).
  firstPublishedAt: timestamp('first_published_at', { precision: 3, withTimezone: true, mode: 'string' }),
  updatedBy: cuid2('updated_by').references(() => users.id, { onUpdate: 'cascade', onDelete: 'set null' }),
  // 'theme' is a plain collection. 'month' is a month guide with month 1..12.
  kind: varchar('kind').notNull().default('theme').$type<CollectionKind>(),
  month: integer('month'),
  sources: jsonb('sources').$type<SourceLink[]>().notNull().default(sql`'[]'::jsonb`),
  // Ordered page modules (ADR 0023). Empty keeps the classic article layout.
  modules: jsonb('modules').$type<StoredPageModule[]>().notNull().default(sql`'[]'::jsonb`),
})

export const collectionItems = pgTable('collection_items', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  collectionId: cuid2('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  placeId: cuid2('place_id').notNull().references(() => places.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  position: integer('position').notNull(),
  note: text('note'),
}, (table) => [
  uniqueIndex('collection_items_position').on(table.collectionId, table.position),
])

export const relatedLinks = pgTable('related_links', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  fromPlaceId: cuid2('from_place_id').notNull().references(() => places.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  toPlaceId: cuid2('to_place_id').notNull().references(() => places.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  anchor: varchar('anchor'),
  position: integer('position').notNull().default(0),
})

export const contentImports = pgTable('content_imports', {
  id: varchar('id').primaryKey(),
  appliedAt: timestamp('applied_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

export const slugRedirects = pgTable('slug_redirects', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  fromPath: varchar('from_path').notNull().unique(),
  toPath: varchar('to_path'),
  statusCode: integer('status_code').notNull().default(301),
})

export const mcpAudits = pgTable('mcp_audits', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  actor: varchar('actor').notNull().default('mcp'),
  tool: varchar('tool').notNull(),
  entityType: varchar('entity_type'),
  entityId: varchar('entity_id'),
})

export const revisions = pgTable('revisions', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  entityType: varchar('entity_type').notNull(),
  entityId: varchar('entity_id').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  updatedBy: cuid2('updated_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
})

export const venues = pgTable('venues', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  name: varchar('name').notNull(),
  kind: varchar('kind').notNull(),
  cuisineTags: jsonb('cuisine_tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  regionId: cuid2('region_id').references(() => regions.id, { onUpdate: 'cascade', onDelete: 'set null' }),
  address: text('address'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  priceLevel: integer('price_level'),
  /** Computed comparison: low, mid, or high. Null until enough published peers exist. Not the 1–4 editorial mark. */
  priceBand: varchar('price_band').$type<'low' | 'mid' | 'high' | null>(),
  priceBandComputedAt: timestamp('price_band_computed_at', { precision: 3, withTimezone: true, mode: 'string' }),
  /** How many of this venue's prices had a town comparison when the band was stored. */
  priceBandBasis: integer('price_band_basis'),
  avgCheck: integer('avg_check'),
  hours: jsonb('hours').$type<VenueHours>().notNull().default(sql`'{"days":[],"note":null}'::jsonb`),
  phone: varchar('phone'),
  website: varchar('website'),
  socials: jsonb('socials').$type<VenueSocial[]>().notNull().default(sql`'[]'::jsonb`),
  /** Numeric id of the VK community linked in socials by screen name (ADR 0048). */
  vkCommunityId: bigint('vk_community_id', { mode: 'number' }),
  bookingUrl: varchar('booking_url'),
  orderUrl: varchar('order_url'),
  deliveryUrl: varchar('delivery_url'),
  menuUrl: varchar('menu_url'),
  reservation: varchar('reservation').$type<VenueReservation | null>(),
  takeaway: boolean('takeaway'),
  delivery: boolean('delivery'),
  signatureDishes: jsonb('signature_dishes').$type<VenueDish[]>().notNull().default(sql`'[]'::jsonb`),
  // Page modules (docs/venue-modules.md), validated in the web app.
  modules: jsonb('modules').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  contactEmail: varchar('contact_email'),
  description: text('description').notNull().default(''),
  sources: jsonb('sources').$type<SourceLink[]>().notNull().default(sql`'[]'::jsonb`),
  status: varchar('status').notNull().default('draft').$type<VenueStatus>(),
  firstPublishedAt: timestamp('first_published_at', { precision: 3, withTimezone: true, mode: 'string' }),
  lastVerifiedAt: timestamp('last_verified_at', { precision: 3, withTimezone: true, mode: 'string' }),
  osmId: varchar('osm_id').unique(),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  noindex: boolean('noindex').notNull().default(false),
  updatedBy: cuid2('updated_by').references(() => users.id, { onUpdate: 'cascade', onDelete: 'set null' }),
}, (table) => [
  index('venues_status_idx').on(table.status),
  index('venues_kind_idx').on(table.kind),
  index('venues_region_idx').on(table.regionId),
  check('venues_price_level_check', sql`${table.priceLevel} is null or ${table.priceLevel} between 1 and 4`),
  check('venues_price_band_check', sql`${table.priceBand} is null or ${table.priceBand} in ('low', 'mid', 'high')`),
  check('venues_price_band_basis_check', sql`${table.priceBandBasis} is null or ${table.priceBandBasis} >= 0`),
  index('venues_price_band_idx').on(table.regionId, table.priceBand),
  check('venues_avg_check_check', sql`${table.avgCheck} is null or ${table.avgCheck} >= 0`),
  check('venues_status_check', sql`${table.status} in ('draft', 'published', 'closed', 'archived')`),
  check('venues_reservation_check', sql`${table.reservation} is null or ${table.reservation} in ('yes', 'no', 'required', 'recommended')`),
  check('venues_vk_community_id_check', sql`${table.vkCommunityId} is null or ${table.vkCommunityId} > 0`),
])

export const venueMedia = pgTable('venue_media', {
  id: cuid2('id').defaultRandom().primaryKey(),
  venueId: cuid2('venue_id').notNull().references(() => venues.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  mediaId: cuid2('media_id').notNull().references(() => media.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isCover: boolean('is_cover').notNull().default(false),
  origin: varchar('origin').$type<VenuePhotoOrigin | null>(),
}, (table) => [
  uniqueIndex('venue_media_venue_media').on(table.venueId, table.mediaId),
  check('venue_media_origin_check', sql`${table.origin} is null or ${table.origin} in ('own', 'venue', 'commons')`),
  index('venue_media_venue_idx').on(table.venueId),
])

/**
 * Shared catalog of benchmark menu items («Ориентиры цен»). One row per
 * familiar dish or drink, so prices compare across venues and feed
 * collections like «Топ капучино области».
 */
export const priceItems = pgTable('price_items', {
  id: cuid2('id').defaultRandom().primaryKey(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  category: varchar('category').notNull(),
  defaultVariant: varchar('default_variant'),
  sortOrder: integer('sort_order').notNull().default(0),
  // Optional custom picture. A site path or https URL. Null uses the food sticker when the slug has one, otherwise the line icon.
  image: varchar('image'),
  createdAt: createdAt(),
})

/** A venue's price for a catalog item. Only official sources or the owner. */
export const venuePrices = pgTable('venue_prices', {
  id: cuid2('id').defaultRandom().primaryKey(),
  venueId: cuid2('venue_id').notNull().references(() => venues.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  itemId: cuid2('item_id').notNull().references(() => priceItems.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  variant: varchar('variant').notNull().default(''),
  priceRub: integer('price_rub').notNull(),
  checkedAt: date('checked_at', { mode: 'string' }).notNull(),
  sourceKind: varchar('source_kind').notNull().$type<'official' | 'owner'>(),
  sourceTitle: varchar('source_title').notNull(),
  sourceUrl: varchar('source_url'),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('venue_prices_venue_item_variant').on(table.venueId, table.itemId, table.variant),
  index('venue_prices_item_idx').on(table.itemId),
  check('venue_prices_price_check', sql`${table.priceRub} > 0`),
  check('venue_prices_source_check', sql`${table.sourceKind} in ('official', 'owner')`),
])

export const venueListingIntros = pgTable('venue_listing_intros', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  regionId: cuid2('region_id').references(() => regions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  kind: varchar('kind'),
  body: text('body').notNull().default(''),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  // Optional listing modules (docs/venue-modules.md). Empty keeps the card grid.
  modules: jsonb('modules').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
})

export const businesses = pgTable('businesses', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  name: varchar('name').notNull(),
  contactEmail: varchar('contact_email'),
  ownerUserId: cuid2('owner_user_id').references(() => users.id, { onUpdate: 'cascade' }),
  // Later subscription and offers hang off the claimed venue (ADR 0030).
  venueId: cuid2('venue_id').references(() => venues.id, { onUpdate: 'cascade', onDelete: 'set null' }),
}, (table) => [
  uniqueIndex('businesses_venue_idx').on(table.venueId).where(sql`${table.venueId} is not null`),
])

export const venueMembers = pgTable('venue_members', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  venueId: cuid2('venue_id').notNull().references(() => venues.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  userId: cuid2('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  role: varchar('role').notNull().$type<VenueMemberRole>(),
}, (table) => [
  uniqueIndex('venue_members_venue_user_idx').on(table.venueId, table.userId),
  uniqueIndex('venue_members_one_owner_idx').on(table.venueId).where(sql`${table.role} = 'owner'`),
  index('venue_members_user_idx').on(table.userId),
  check('venue_members_role_check', sql`${table.role} in ('owner', 'editor')`),
])

export const venueClaims = pgTable('venue_claims', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  venueId: cuid2('venue_id').notNull().references(() => venues.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  userId: cuid2('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  status: varchar('status').notNull().default('pending').$type<ClaimStatus>(),
  channel: varchar('channel').notNull().$type<ClaimChannel>(),
  destination: varchar('destination'),
  codeHash: varchar('code_hash'),
  codeExpiresAt: timestamp('code_expires_at', { precision: 3, withTimezone: true, mode: 'string' }),
  attempts: integer('attempts').notNull().default(0),
  evidence: text('evidence'),
  decidedAt: timestamp('decided_at', { precision: 3, withTimezone: true, mode: 'string' }),
  decidedBy: cuid2('decided_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
}, (table) => [
  uniqueIndex('venue_claims_open_idx').on(table.venueId, table.userId).where(sql`${table.status} = 'pending'`),
  index('venue_claims_status_idx').on(table.status, table.createdAt),
  check('venue_claims_status_check', sql`${table.status} in ('pending', 'verified', 'rejected', 'withdrawn')`),
  check('venue_claims_channel_check', sql`${table.channel} in ('email', 'phone', 'manual')`),
])

export const venueAudits = pgTable('venue_audits', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  venueId: cuid2('venue_id').notNull().references(() => venues.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  actorUserId: cuid2('actor_user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  action: varchar('action').notNull(),
  summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
}, (table) => [
  index('venue_audits_venue_idx').on(table.venueId, table.createdAt),
])

export const offers = pgTable('offers', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  businessId: cuid2('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  placeId: cuid2('place_id').references(() => places.id, { onUpdate: 'cascade' }),
  routeId: cuid2('route_id').references(() => routes.id, { onUpdate: 'cascade' }),
  venueId: cuid2('venue_id').references(() => venues.id, { onUpdate: 'cascade', onDelete: 'set null' }),
  title: varchar('title').notNull(),
  terms: text('terms').notNull(),
  kind: varchar('kind').notNull().default('discount').$type<OfferKind>(),
  bid: integer('bid'),
  budget: integer('budget'),
  spent: integer('spent').notNull().default(0),
  status: varchar('status').notNull().default('draft').$type<OfferStatus>(),
})

export const offerCodes = pgTable('offer_codes', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  offerId: cuid2('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  code: varchar('code').notNull().unique(),
  status: varchar('status').notNull().default('issued').$type<OfferCodeStatus>(),
  issuedAt: timestamp('issued_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  redeemedAt: timestamp('redeemed_at', { precision: 3, withTimezone: true, mode: 'string' }),
  sessionId: varchar('session_id'),
})

export const events = pgTable('events', {
  id: cuid2('id').defaultRandom().primaryKey(),
  occurredAt: timestamp('occurred_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  type: varchar('type').notNull(),
  placeId: cuid2('place_id').references(() => places.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  placeSlug: varchar('place_slug'),
  routeSlug: varchar('route_slug'),
  questSlug: varchar('quest_slug'),
  sessionId: varchar('session_id').notNull(),
  consent: boolean('consent').notNull(),
}, (table) => [
  index('events_occurred_at_idx').on(table.occurredAt),
  index('events_place_slug_idx').on(table.placeSlug),
  check('events_consent_required', sql`${table.consent} = true`),
])

export const analyticsHits = pgTable('analytics_hits', {
  id: varchar('id').primaryKey(),
  occurredAt: timestamp('occurred_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  visitorKey: varchar('visitor_key').notNull(),
  visitorMode: varchar('visitor_mode').notNull(),
  sessionKey: varchar('session_key').notNull(),
  consented: boolean('consented').notNull().default(false),
  isBot: boolean('is_bot').notNull().default(false),
  eventType: varchar('event_type').notNull(),
  path: varchar('path').notNull(),
  placeId: varchar('place_id'),
  routeId: varchar('route_id'),
  venueId: varchar('venue_id'),
  referrer: varchar('referrer'),
  referrerHost: varchar('referrer_host'),
  utmSource: varchar('utm_source'),
  utmMedium: varchar('utm_medium'),
  utmCampaign: varchar('utm_campaign'),
  channel: varchar('channel').notNull(),
  searchQuery: varchar('search_query'),
  device: varchar('device'),
  browser: varchar('browser'),
  os: varchar('os'),
  screenBucket: varchar('screen_bucket'),
  language: varchar('language'),
  landingPath: varchar('landing_path'),
  isEntry: boolean('is_entry').notNull().default(false),
  isExit: boolean('is_exit').notNull().default(false),
  engagedMs: integer('engaged_ms'),
  scrollBucket: varchar('scroll_bucket'),
  target: varchar('target'),
}, (table) => [
  index('analytics_hits_occurred_idx').on(table.occurredAt),
  index('analytics_hits_session_idx').on(table.sessionKey, table.occurredAt),
  index('analytics_hits_visitor_idx').on(table.visitorKey, table.occurredAt),
  index('analytics_hits_path_idx').on(table.path, table.occurredAt),
  index('analytics_hits_venue_idx').on(table.venueId, table.occurredAt),
])

export const analyticsDaily = pgTable('analytics_daily', {
  day: date('day').notNull(),
  path: varchar('path').notNull().default(''),
  channel: varchar('channel').notNull().default(''),
  device: varchar('device').notNull().default(''),
  pageviews: integer('pageviews').notNull().default(0),
  visitors: integer('visitors').notNull().default(0),
  sessions: integer('sessions').notNull().default(0),
  bounces: integer('bounces').notNull().default(0),
  engagedMs: bigint('engaged_ms', { mode: 'number' }).notNull().default(0),
  outbound: integer('outbound').notNull().default(0),
  photos: integer('photos').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.day, table.path, table.channel, table.device] }),
])

export const analyticsSearchQueries = pgTable('analytics_search_queries', {
  day: date('day').notNull(),
  engine: varchar('engine').notNull(),
  page: varchar('page').notNull().default(''),
  query: text('query').notNull(),
  impressions: integer('impressions').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  position: real('position'),
}, (table) => [
  primaryKey({ columns: [table.day, table.engine, table.page, table.query] }),
])

export const pagePassports = pgTable('page_passports', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  pageType: varchar('page_type').notNull().$type<PageKind>(),
  entityId: varchar('entity_id').notNull(),
  path: varchar('path').notNull(),
  targetQueries: jsonb('target_queries').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  audience: text('audience'),
  primaryAction: varchar('primary_action').$type<PrimaryAction | null>(),
  goal30d: integer('goal_30d'),
  goal90d: integer('goal_90d'),
  notes: text('notes'),
  lengthOverride: jsonb('length_override').$type<LengthOverride | null>(),
}, (table) => [
  uniqueIndex('page_passports_page_idx').on(table.pageType, table.entityId),
  uniqueIndex('page_passports_path_idx').on(table.path),
])

// Target personas of a page (ADR 0024). Codes come from the registry in
// apps/web-app/shared/personas.ts. One primary persona per page.
export const pagePersonas = pgTable('page_personas', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  pageType: varchar('page_type').notNull().$type<PageKind>(),
  entityId: varchar('entity_id').notNull(),
  personaCode: varchar('persona_code').notNull(),
  weight: integer('weight').notNull().default(1),
  primary: boolean('primary').notNull().default(false),
}, (table) => [
  uniqueIndex('page_personas_page_persona_idx').on(table.pageType, table.entityId, table.personaCode),
  uniqueIndex('page_personas_primary_idx').on(table.pageType, table.entityId).where(sql`"primary"`),
])

export const contentScores = pgTable('content_scores', {
  id: cuid2('id').defaultRandom().primaryKey(),
  computedAt: timestamp('computed_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  pageType: varchar('page_type').notNull().$type<PageKind>(),
  entityId: varchar('entity_id').notNull(),
  path: varchar('path').notNull(),
  title: varchar('title').notNull(),
  total: integer('total').notNull(),
  quality: integer('quality').notNull(),
  linking: integer('linking').notNull(),
  indexing: integer('indexing').notNull(),
  results: integer('results').notNull(),
  checks: jsonb('checks').$type<ScoreChecks>().notNull().default(sql`'{}'::jsonb`),
  signals: jsonb('signals').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
}, (table) => [
  uniqueIndex('content_scores_page_idx').on(table.pageType, table.entityId),
  index('content_scores_path_idx').on(table.path),
])

export const contentScoreDays = pgTable('content_score_days', {
  day: date('day').notNull(),
  pageType: varchar('page_type').notNull().$type<PageKind>(),
  entityId: varchar('entity_id').notNull(),
  path: varchar('path').notNull(),
  title: varchar('title').notNull(),
  total: integer('total').notNull(),
  quality: integer('quality').notNull(),
  linking: integer('linking').notNull(),
  indexing: integer('indexing').notNull(),
  results: integer('results').notNull(),
  organic30d: integer('organic_30d').notNull().default(0),
  organic90d: integer('organic_90d').notNull().default(0),
  goal30d: integer('goal_30d'),
  goal90d: integer('goal_90d'),
}, (table) => [
  primaryKey({ columns: [table.day, table.pageType, table.entityId] }),
])

export const analyticsRuns = pgTable('analytics_runs', {
  day: date('day').notNull(),
  kind: varchar('kind').notNull(),
}, (table) => [
  primaryKey({ columns: [table.day, table.kind] }),
])

// Schedules for any entity (ADR 0028). Rules are validated by the web app.
export const schedules = pgTable('schedules', {
  id: cuid2('id').defaultRandom().primaryKey(),
  entityType: varchar('entity_type').notNull(),
  entityId: varchar('entity_id').notNull(),
  rules: jsonb('rules').$type<Record<string, unknown>>().notNull(),
  sourceUrl: varchar('source_url'),
  verifiedAt: date('verified_at', { mode: 'string' }),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('schedules_entity').on(table.entityType, table.entityId),
])

// Typed claims (ADR 0033). One live row per kind, subject, and slot.
export const facts = pgTable('facts', {
  id: cuid2('id').defaultRandom().primaryKey(),
  kind: varchar('kind').notNull(),
  subjectType: varchar('subject_type').notNull(),
  subjectId: varchar('subject_id').notNull(),
  slot: varchar('slot').notNull(),
  value: jsonb('value').notNull(),
  valueHash: varchar('value_hash').notNull(),
  sourceUrl: varchar('source_url'),
  sourceTitle: varchar('source_title'),
  sourceKind: varchar('source_kind').notNull(),
  checkedAt: timestamp('checked_at', { precision: 3, withTimezone: true, mode: 'string' }),
  ttlDays: integer('ttl_days').notNull(),
  confidence: varchar('confidence').notNull(),
  retiredAt: timestamp('retired_at', { precision: 3, withTimezone: true, mode: 'string' }),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('facts_live_key_idx').on(table.kind, table.subjectType, table.subjectId, table.slot).where(sql`${table.retiredAt} is null`),
  index('facts_kind_checked_idx').on(table.kind, table.checkedAt),
  check('facts_kind_check', sql`${table.kind} in ('hours', 'price', 'phone', 'address', 'coordinates', 'status')`),
  check('facts_subject_check', sql`${table.subjectType} in ('place', 'venue', 'route', 'route_stop', 'region')`),
  check('facts_source_check', sql`${table.sourceKind} in ('official', 'official_social', 'map_yandex', 'map_2gis', 'map_google', 'osm', 'owner', 'none')`),
  check('facts_confidence_check', sql`${table.confidence} in ('stated', 'owner', 'gap')`),
  check('facts_ttl_check', sql`${table.ttlDays} > 0`),
])

export const factRevisions = pgTable('fact_revisions', {
  id: cuid2('id').defaultRandom().primaryKey(),
  factId: cuid2('fact_id').notNull().references(() => facts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  recordedAt: timestamp('recorded_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  value: jsonb('value').notNull(),
  valueHash: varchar('value_hash').notNull(),
  sourceUrl: varchar('source_url'),
  sourceTitle: varchar('source_title'),
  sourceKind: varchar('source_kind').notNull(),
  checkedAt: timestamp('checked_at', { precision: 3, withTimezone: true, mode: 'string' }),
  confidence: varchar('confidence').notNull(),
  actor: varchar('actor').notNull(),
}, (table) => [
  index('fact_revisions_fact_recorded_idx').on(table.factId, table.recordedAt),
  check('fact_revisions_actor_check', sql`${table.actor} in ('migration', 'editor', 'owner', 'mcp')`),
  check('fact_revisions_confidence_check', sql`${table.confidence} in ('stated', 'owner', 'gap')`),
])

export const factRefs = pgTable('fact_refs', {
  id: cuid2('id').defaultRandom().primaryKey(),
  factId: cuid2('fact_id').notNull().references(() => facts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  consumerType: varchar('consumer_type').notNull(),
  consumerId: varchar('consumer_id').notNull(),
  path: varchar('path').notNull(),
}, (table) => [
  uniqueIndex('fact_refs_unique').on(table.factId, table.consumerType, table.consumerId, table.path),
  index('fact_refs_consumer_idx').on(table.consumerType, table.consumerId),
  index('fact_refs_fact_idx').on(table.factId),
])

export const sourceDocuments = pgTable('source_documents', {
  url: varchar('url').primaryKey(),
  contentHash: varchar('content_hash'),
  etag: varchar('etag'),
  lastModified: varchar('last_modified'),
  httpStatus: integer('http_status'),
  fetchedAt: timestamp('fetched_at', { precision: 3, withTimezone: true, mode: 'string' }),
  nextFetchAt: timestamp('next_fetch_at', { precision: 3, withTimezone: true, mode: 'string' }),
  failCount: integer('fail_count').notNull().default(0),
}, (table) => [
  index('source_documents_next_fetch_idx').on(table.nextFetchAt),
])

export const pageReviews = pgTable('page_reviews', {
  id: cuid2('id').defaultRandom().primaryKey(),
  pageType: varchar('page_type').notNull(),
  entityId: varchar('entity_id').notNull(),
  reviewedAt: timestamp('reviewed_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  reviewer: varchar('reviewer').notNull(),
  sections: jsonb('sections').$type<Array<{ path: string, hash: string }>>().notNull().default(sql`'[]'::jsonb`),
}, (table) => [
  uniqueIndex('page_reviews_page_idx').on(table.pageType, table.entityId),
])

export const verificationQueue = pgTable('verification_queue', {
  id: cuid2('id').defaultRandom().primaryKey(),
  target: varchar('target').notNull(),
  factId: cuid2('fact_id').references(() => facts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  pageType: varchar('page_type'),
  entityId: varchar('entity_id'),
  path: varchar('path'),
  reason: varchar('reason').notNull(),
  priority: integer('priority').notNull().default(0),
  enqueuedAt: timestamp('enqueued_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  lockedBy: varchar('locked_by'),
  lockedUntil: timestamp('locked_until', { precision: 3, withTimezone: true, mode: 'string' }),
  resolvedAt: timestamp('resolved_at', { precision: 3, withTimezone: true, mode: 'string' }),
  // Proposed value when the content token must not overwrite an owner fact.
  proposal: jsonb('proposal').$type<Record<string, unknown> | null>(),
}, (table) => [
  index('verification_queue_open_idx').on(table.priority, table.enqueuedAt).where(sql`${table.resolvedAt} is null`),
  uniqueIndex('verification_queue_fact_open_idx').on(table.factId, table.reason).where(sql`${table.resolvedAt} is null and ${table.target} = 'fact'`),
  uniqueIndex('verification_queue_section_open_idx').on(table.pageType, table.entityId, table.path, table.reason).where(sql`${table.resolvedAt} is null and ${table.target} = 'section'`),
  check('verification_queue_target_check', sql`${table.target} in ('fact', 'section')`),
  check('verification_queue_reason_check', sql`${table.reason} in ('source_changed', 'ttl_expired', 'fetch_failed', 'source_gone', 'season_boundary', 'section_changed', 'unseeded', 'owner_conflict', 'fact_repeated', 'guest_report')`),
])

// Concrete open intervals for a rolling window, rebuilt on write and daily.
export const scheduleIntervals = pgTable('schedule_intervals', {
  entityType: varchar('entity_type').notNull(),
  entityId: varchar('entity_id').notNull(),
  startsAt: timestamp('starts_at', { precision: 0, withTimezone: true, mode: 'string' }).notNull(),
  endsAt: timestamp('ends_at', { precision: 0, withTimezone: true, mode: 'string' }).notNull(),
  lastEntryAt: timestamp('last_entry_at', { precision: 0, withTimezone: true, mode: 'string' }),
  /** No known closing time (ADR 0042): `ends_at` is the end of that local day, not a close. */
  openEnded: boolean('open_ended').notNull().default(false),
}, (table) => [
  index('schedule_intervals_entity').on(table.entityType, table.entityId),
  index('schedule_intervals_time').on(table.startsAt, table.endsAt),
])

// Site search events (ADR 0030). No cookie, no IP: the visitor key is the
// ADR 0013 daily HMAC and the session key comes from the latest page view.
export const searchEvents = pgTable('search_events', {
  id: varchar('id').primaryKey(),
  occurredAt: timestamp('occurred_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  searchId: varchar('search_id').notNull(),
  eventType: varchar('event_type').notNull().$type<'search' | 'click'>(),
  visitorKey: varchar('visitor_key').notNull(),
  sessionKey: varchar('session_key'),
  isBot: boolean('is_bot').notNull().default(false),
  surface: varchar('surface'),
  query: text('query'),
  normalized: text('normalized'),
  resultCount: integer('result_count'),
  refinedFrom: varchar('refined_from'),
  position: integer('position'),
  resultPath: varchar('result_path'),
}, (table) => [
  index('search_events_occurred_idx').on(table.occurredAt),
  index('search_events_search_idx').on(table.searchId),
  index('search_events_session_idx').on(table.sessionKey, table.occurredAt),
  index('search_events_normalized_idx').on(table.normalized, table.occurredAt),
  check('search_events_type_check', sql`${table.eventType} in ('search', 'click')`),
])

export const guestSubmissions = pgTable('guest_submissions', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  userId: cuid2('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  subjectType: varchar('subject_type').notNull().$type<'place' | 'venue'>(),
  subjectId: varchar('subject_id').notNull(),
  kind: varchar('kind').notNull().$type<'review' | 'tip' | 'photo' | 'correction'>(),
  status: varchar('status').notNull().default('pending').$type<'pending' | 'accepted' | 'rejected' | 'removed'>(),
  body: text('body'),
  alt: varchar('alt'),
  correctionKind: varchar('correction_kind').$type<'hours' | 'phone' | 'address' | 'status' | 'price' | 'other' | null>(),
  correctionValue: varchar('correction_value'),
  sourceUrl: varchar('source_url'),
  mediaId: cuid2('media_id').references(() => media.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  decidedBy: cuid2('decided_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  decidedAt: timestamp('decided_at', { precision: 3, withTimezone: true, mode: 'string' }),
  decisionNote: text('decision_note'),
  disputed: boolean('disputed').notNull().default(false),
  bodyKey: varchar('body_key'),
}, (table) => [
  uniqueIndex('guest_submissions_pending_idx').on(table.userId, table.subjectType, table.subjectId, table.kind).where(sql`${table.status} = 'pending'`),
  uniqueIndex('guest_submissions_accepted_review_idx').on(table.userId, table.subjectType, table.subjectId).where(sql`${table.status} = 'accepted' and ${table.kind} = 'review'`),
  uniqueIndex('guest_submissions_accepted_tip_idx').on(table.userId, table.subjectType, table.subjectId).where(sql`${table.status} = 'accepted' and ${table.kind} = 'tip'`),
  uniqueIndex('guest_submissions_body_idx').on(table.subjectType, table.subjectId, table.kind, table.bodyKey).where(sql`${table.status} in ('pending', 'accepted') and ${table.bodyKey} is not null`),
  index('guest_submissions_public_idx').on(table.subjectType, table.subjectId, table.decidedAt).where(sql`${table.status} = 'accepted'`),
  index('guest_submissions_queue_idx').on(table.createdAt).where(sql`${table.status} = 'pending'`),
  check('guest_submissions_subject_check', sql`${table.subjectType} in ('place', 'venue')`),
  check('guest_submissions_kind_check', sql`${table.kind} in ('review', 'tip', 'photo', 'correction')`),
  check('guest_submissions_status_check', sql`${table.status} in ('pending', 'accepted', 'rejected', 'removed')`),
  check('guest_submissions_correction_check', sql`${table.correctionKind} is null or ${table.correctionKind} in ('hours', 'phone', 'address', 'status', 'price', 'other')`),
])

/** Action, submission id, actor, and time. No body, email, or file. */
export const guestAudits = pgTable('guest_audits', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  submissionId: varchar('submission_id').notNull(),
  actorUserId: cuid2('actor_user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  action: varchar('action').notNull(),
}, (table) => [
  index('guest_audits_submission_idx').on(table.submissionId, table.createdAt),
])
