import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { Analytics } from './analytics'
import { VenueClaims } from './claims'
import { Consent } from './consent'
import { Content, Editor } from './content'
import { EventLog } from './event-log'
import { MapCatalog } from './map'
import { Prices } from './prices'
import { Schedules } from './schedules'
import { Scoring } from './scoring'
import { Search } from './search'
import { User } from './user'
import { Venues } from './venues'

class Repository {
  readonly analytics = Analytics
  readonly consent = Consent
  readonly content = Content
  readonly editor = Editor
  readonly eventLog = EventLog
  readonly map = MapCatalog
  readonly prices = Prices
  readonly schedules = Schedules
  readonly scoring = Scoring
  readonly search = Search
  readonly user = User
  readonly venueClaims = VenueClaims
  readonly venues = Venues

  async checkHealth(): Promise<boolean> {
    await useDatabase().execute(sql`select 1`)
    return true
  }
}

export const repository = new Repository()
