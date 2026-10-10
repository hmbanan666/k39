import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type * as tables from '../tables'

export type { Database } from '../connection'

export type User = InferSelectModel<typeof tables.users>
export type UserDraft = InferInsertModel<typeof tables.users>

export type Region = InferSelectModel<typeof tables.regions>
export type RegionDraft = InferInsertModel<typeof tables.regions>

export type Place = InferSelectModel<typeof tables.places>
export type PlaceDraft = InferInsertModel<typeof tables.places>

export type Route = InferSelectModel<typeof tables.routes>
export type RouteDraft = InferInsertModel<typeof tables.routes>

export type RoutePoint = InferSelectModel<typeof tables.routePoints>
export type RoutePointDraft = InferInsertModel<typeof tables.routePoints>

export type Quest = InferSelectModel<typeof tables.quests>
export type QuestDraft = InferInsertModel<typeof tables.quests>

export type QuestStep = InferSelectModel<typeof tables.questSteps>
export type QuestStepDraft = InferInsertModel<typeof tables.questSteps>

export type Business = InferSelectModel<typeof tables.businesses>
export type BusinessDraft = InferInsertModel<typeof tables.businesses>

export type Offer = InferSelectModel<typeof tables.offers>
export type OfferDraft = InferInsertModel<typeof tables.offers>

export type OfferCode = InferSelectModel<typeof tables.offerCodes>
export type OfferCodeDraft = InferInsertModel<typeof tables.offerCodes>

export type EventLogRecord = InferSelectModel<typeof tables.events>
export type EventLogDraft = InferInsertModel<typeof tables.events>
