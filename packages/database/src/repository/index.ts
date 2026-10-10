import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { Catalog } from './catalog'
import { EventLog } from './event-log'
import { Place } from './place'
import { Quest } from './quest'
import { Region } from './region'
import { Route } from './route'
import { User } from './user'

class Repository {
  readonly catalog = Catalog
  readonly eventLog = EventLog
  readonly place = Place
  readonly quest = Quest
  readonly region = Region
  readonly route = Route
  readonly user = User

  async checkHealth(): Promise<boolean> {
    await useDatabase().execute(sql`select 1`)
    return true
  }
}

export const repository = new Repository()
