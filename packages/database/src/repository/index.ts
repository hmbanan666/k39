import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { Analytics } from './analytics'
import { Consent } from './consent'
import { Content, Editor } from './content'
import { EventLog } from './event-log'
import { Scoring } from './scoring'
import { User } from './user'

class Repository {
  readonly analytics = Analytics
  readonly consent = Consent
  readonly content = Content
  readonly editor = Editor
  readonly eventLog = EventLog
  readonly scoring = Scoring
  readonly user = User

  async checkHealth(): Promise<boolean> {
    await useDatabase().execute(sql`select 1`)
    return true
  }
}

export const repository = new Repository()
