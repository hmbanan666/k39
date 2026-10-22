import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { Analytics } from './analytics'
import { VenueClaims } from './claims'
import { Consent } from './consent'
import { Content, Editor } from './content'
import { EventLog } from './event-log'
import { Facts } from './facts'
import { Guests } from './guests'
import { MapCatalog } from './map'
import { Notices } from './notices'
import { Admission, CalendarEvents, practicalSubjects } from './practical'
import { Prices } from './prices'
import { Schedules } from './schedules'
import { Scoring } from './scoring'
import { Search } from './search'
import { User } from './user'
import { Venues } from './venues'

class Repository {
  readonly admission = Admission
  readonly analytics = Analytics
  readonly calendarEvents = CalendarEvents
  readonly consent = Consent
  readonly facts = Facts
  readonly guests = Guests
  readonly content = Content
  readonly editor = Editor
  readonly eventLog = EventLog
  readonly map = MapCatalog
  readonly practicalSubjects = practicalSubjects
  readonly notices = Notices
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
