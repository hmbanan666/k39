import type { EventLogDraft, EventLogRecord } from '../types'
import { useDatabase } from '../database'
import { events } from '../tables'

export class EventLog {
  static async create(data: EventLogDraft): Promise<EventLogRecord> {
    const [row] = await useDatabase().insert(events).values(data).returning()
    if (!row) {
      throw new Error('Event insert failed')
    }
    return row
  }
}
