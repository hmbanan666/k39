import process from 'node:process'
import { db } from '@k39/database'
import { DEV_EDITOR_EMAIL, devEditorSessionAllowed } from '../../../shared/dev-editor-session'
import { devEditorTokenMatches, readDevEditorToken } from '../../utils/dev-editor-token'

function envFlag(name: string) {
  return process.env[name]
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''
  const allowed = devEditorSessionAllowed({
    dev: import.meta.dev,
    nodeEnv: envFlag('NODE_ENV'),
    flag: envFlag('DEV_EDITOR_SESSION'),
    host: getRequestHeader(event, 'host'),
    remoteAddress: event.node.req.socket?.remoteAddress,
    tokenMatches: devEditorTokenMatches(token, readDevEditorToken()),
  })
  if (!allowed) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  let user = await db.user.findByEmail(DEV_EDITOR_EMAIL)
  if (!user) {
    user = await db.user.create({
      email: DEV_EDITOR_EMAIL,
      name: 'Редактор',
      role: 'editor',
    })
  } else if (user.role === 'user') {
    const updated = await db.user.update(user.id, { role: 'editor' })
    if (!updated) {
      throw createError({ statusCode: 500, statusMessage: 'Could not set the dev editor role' })
    }
    user = updated
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  })
  return sendRedirect(event, '/admin', 302)
})
