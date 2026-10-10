import type { OfferCodeStatus, OfferKind, OfferStatus, PlaceStatus } from './types/entities'
import { cuid2 } from 'drizzle-cuid2/postgres'
import { sql } from 'drizzle-orm'
import { boolean, check, doublePrecision, index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

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
})

export const regions = pgTable('regions', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  description: text('description'),
})

export const places = pgTable('places', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  type: varchar('type').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  status: varchar('status').notNull().default('unknown').$type<PlaceStatus>(),
  hours: varchar('hours'),
  sourceUrl: varchar('source_url'),
  regionId: cuid2('region_id').references(() => regions.id, { onUpdate: 'cascade' }),
})

export const routes = pgTable('routes', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  title: varchar('title').notNull(),
  summary: text('summary'),
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

export const businesses = pgTable('businesses', {
  id: cuid2('id').defaultRandom().primaryKey(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  slug: varchar('slug').notNull().unique(),
  name: varchar('name').notNull(),
  contactEmail: varchar('contact_email'),
  ownerUserId: cuid2('owner_user_id').references(() => users.id, { onUpdate: 'cascade' }),
})

// Pay-per-result offers. `bid` and `budget` are integer kopecks for a later auction.
// A draft may omit place and route; an active offer should reference at least one.
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

// Anonymous product analytics. No IP, no account id. Consent must be true.
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
