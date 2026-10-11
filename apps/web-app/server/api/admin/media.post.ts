import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { db } from '@k39/database'
import { createId } from '@paralleldrive/cuid2'
import { requireEditor } from '../../utils/access'
import { readImageSize } from '../../utils/image-size'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.data)
  const alt = String(parts?.find((part) => part.name === 'alt')?.data?.toString() || '')
  if (!file || !alt.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны файл и alt' })
  }
  const mime = file.type || 'application/octet-stream'
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg'
  const filename = `${createId()}.${ext}`
  const dir = process.env.MEDIA_DIR || '/app/media'
  await mkdir(dir, { recursive: true })
  await writeFile(`${dir}/${filename}`, file.data)
  const size = readImageSize(file.data, mime)
  return db.editor.saveMedia({
    filename,
    mime,
    bytes: file.data.length,
    width: size.width,
    height: size.height,
    alt: alt.trim(),
    credit: parts?.find((part) => part.name === 'credit')?.data?.toString() || null,
    sourceUrl: parts?.find((part) => part.name === 'sourceUrl')?.data?.toString() || null,
    placeId: parts?.find((part) => part.name === 'placeId')?.data?.toString() || null,
  })
})
