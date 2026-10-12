import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { Analytics } from './analytics'
import { Content, Editor } from './content'
import { EventLog } from './event-log'
import { User } from './user'

class Repository {
  readonly analytics = Analytics
  readonly content = Content
  readonly editor = Editor
  readonly eventLog = EventLog
  readonly user = User

  async checkHealth(): Promise<boolean> {
    await useDatabase().execute(sql`select 1`)
    return true
  }
}

export const repository = new Repository()
