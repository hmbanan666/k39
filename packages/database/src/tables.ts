import type { AuthorKind, MediaLicense, MediaStatus, MediaVariant, OfferCodeStatus, OfferKind, OfferStatus, PublicationStatus, SourceLink, UserRole, VisitStatus } from './types/entities'
import { cuid2 } from 'drizzle-cuid2/postgres'
import { sql } from 'drizzle-orm'
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

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

export const regions = pgTable('regions', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  description: text('description'),
})

export const categories = pgTable('categories', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  ogImage: varchar('og_image'),
  noindex: boolean('noindex').notNull().default(false),
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
  howToGet: text('how_to_get'),
  summary: text('summary').notNull().default(''),
  body: text('body').notNull().default(''),
  sources: jsonb('sources').$type<SourceLink[]>().notNull().default(sql`'[]'::jsonb`),
  lastVerifiedAt: timestamp('last_verified_at', { precision: 3, withTimezone: true, mode: 'string' }),
  authorKind: varchar('author_kind').notNull().default('human').$type<AuthorKind>(),
  seoTitle: varchar('seo_title'),
  seoDescription: varchar('seo_description'),
  ogImage: varchar('og_image'),
  publicationStatus: varchar('publication_status').notNull().default('draft').$type<PublicationStatus>(),
  noindex: boolean('noindex').notNull().default(false),
  updatedBy: cuid2('updated_by').references(() => users.id, { onUpdate: 'cascade', onDelete: 'set null' }),
}, (table) => [
  index('places_publication_idx').on(table.publicationStatus),
  index('places_category_idx').on(table.categoryId),
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

export const routes = pgTable('routes', {
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
  updatedBy: cuid2('updated_by').references(() => users.id, { onUpdate: 'cascade', onDelete: 'set null' }),
  regionId: cuid2('region_id').references(() => regions.id, { onUpdate: 'cascade' }),
})

export const routePoints = pgTable('route_points', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  routeId: cuid2('route_id').notNull().references(() => routes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  placeId: cuid2('place_id').notNull().references(() => places.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  position: integer('position').notNull(),
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
  updatedBy: cuid2('updated_by').references(() => users.id, { onUpdate: 'cascade', onDelete: 'set null' }),
})

export const collectionItems = pgTable('collection_items', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  collectionId: cuid2('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  placeId: cuid2('place_id').notNull().references(() => places.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  position: integer('position').notNull(),
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

export const businesses = pgTable('businesses', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  name: varchar('name').notNull(),
  contactEmail: varchar('contact_email'),
  ownerUserId: cuid2('owner_user_id').references(() => users.id, { onUpdate: 'cascade' }),
})

export const offers = pgTable('offers', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  businessId: cuid2('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  placeId: cuid2('place_id').references(() => places.id, { onUpdate: 'cascade' }),
  routeId: cuid2('route_id').references(() => routes.id, { onUpdate: 'cascade' }),
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
