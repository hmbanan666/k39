import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type * as tables from '../tables'

export type { Database } from '../connection'

export type User = InferSelectModel<typeof tables.users>
export type UserDraft = InferInsertModel<typeof tables.users>

export type Region = InferSelectModel<typeof tables.regions>
export type RegionDraft = InferInsertModel<typeof tables.regions>

export type Category = InferSelectModel<typeof tables.categories>
export type CategoryDraft = InferInsertModel<typeof tables.categories>

export type Place = InferSelectModel<typeof tables.places>
export type PlaceDraft = InferInsertModel<typeof tables.places>

export type Media = InferSelectModel<typeof tables.media>
export type MediaDraft = InferInsertModel<typeof tables.media>

export type Route = InferSelectModel<typeof tables.routes>
export type RouteDraft = InferInsertModel<typeof tables.routes>

export type Quest = InferSelectModel<typeof tables.quests>
export type QuestDraft = InferInsertModel<typeof tables.quests>

export type Collection = InferSelectModel<typeof tables.collections>
export type CollectionDraft = InferInsertModel<typeof tables.collections>

export type SlugRedirect = InferSelectModel<typeof tables.slugRedirects>
export type SlugRedirectDraft = InferInsertModel<typeof tables.slugRedirects>

export type EventLogRecord = InferSelectModel<typeof tables.events>
export type EventLogDraft = InferInsertModel<typeof tables.events>
