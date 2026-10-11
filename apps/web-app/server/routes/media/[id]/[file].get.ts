import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { sendStream, setHeader } from 'h3'
import { createLocalMediaStorage, mediaRoot, resolveMediaKey } from '../../../media/storage'

const FILES = /^(?:master\.webp|og\.jpg|(?:320|640|960|1280|1920)\.(?:avif|webp))$/
const TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
}

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '')
  const file = String(getRouterParam(event, 'file') || '')
  if (!/^[\w-]+$/.test(id) || !FILES.test(file)) {
    throw createError({ statusCode: 404, statusMessage: 'Файл не найден' })
  }
  const key = `${id}/${file}`
  const storage = createLocalMediaStorage()
  if (!(await storage.exists(key))) {
    throw createError({ statusCode: 404, statusMessage: 'Файл не найден' })
  }
  const path = resolveMediaKey(mediaRoot(), key)
  const info = await stat(path)
  const etag = `"${createHash('sha1').update(`${info.size}:${info.mtimeMs}`).digest('hex')}"`
  setHeader(event, 'etag', etag)
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
  const ext = file.split('.').pop() || ''
  setHeader(event, 'content-type', TYPES[ext] || 'application/octet-stream')
  if (getRequestHeader(event, 'if-none-match') === etag) {
    setResponseStatus(event, 304)
    return null
  }
  return sendStream(event, createReadStream(path))
})
