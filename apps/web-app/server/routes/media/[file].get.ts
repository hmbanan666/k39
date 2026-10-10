import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import process from 'node:process'
import { sendStream, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const file = String(getRouterParam(event, 'file') || '')
  if (!/^[\w.-]+$/.test(file)) {
    throw createError({ statusCode: 404, statusMessage: 'Файл не найден' })
  }
  const path = `${process.env.MEDIA_DIR || '/app/media'}/${file}`
  try {
    await stat(path)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Файл не найден' })
  }
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
  return sendStream(event, createReadStream(path))
})
