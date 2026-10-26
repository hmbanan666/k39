import { db } from '@k39/database'
import { requireEditor } from '../../../../utils/access'

function summary(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { name: '', description: '' }
  }
  const row = snapshot as Record<string, unknown>
  const description = typeof row.description === 'string' ? row.description : ''
  return {
    name: typeof row.name === 'string' ? row.name : '',
    description: description.slice(0, 120),
  }
}

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = getRouterParam(event, 'id') || ''
  const venue = await db.venues.byId(id)
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  const revisions = await db.venues.revisions(id)
  const audits = await db.venueClaims.audits(id)
  const actors = new Map<string, string>()
  for (const row of revisions) {
    if (row.updatedBy && !actors.has(row.updatedBy)) {
      const user = await db.user.find(row.updatedBy)
      if (user) {
        actors.set(user.id, user.email)
      }
    }
  }
  return {
    revisions: revisions.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      actorEmail: row.updatedBy ? (actors.get(row.updatedBy) ?? null) : null,
      summary: summary(row.snapshot),
    })),
    audits: audits.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      action: row.action,
      actorEmail: row.actorEmail,
      summary: row.summary,
    })),
  }
})
