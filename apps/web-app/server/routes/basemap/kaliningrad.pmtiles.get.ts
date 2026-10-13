import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { byteSpan } from '../../utils/basemap-range'

export default defineEventHandler(async (event) => {
  const file = useRuntimeConfig().basemapFile || '/app/basemap/kaliningrad.pmtiles'
  let info: { size: number, mtimeMs: number }
  try {
    const found = await stat(file)
    info = { size: found.size, mtimeMs: found.mtimeMs }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Basemap is not mounted' })
  }
  const span = byteSpan(getHeader(event, 'range'), info.size)
  setHeader(event, 'accept-ranges', 'bytes')
  setHeader(event, 'content-type', 'application/vnd.pmtiles')
  setHeader(event, 'cache-control', 'public, max-age=604800')
  setHeader(event, 'etag', `"${info.size}-${Math.round(info.mtimeMs)}"`)
  if (span === 'unsatisfiable') {
    setResponseStatus(event, 416)
    setHeader(event, 'content-range', `bytes */${info.size}`)
    return ''
  }
  const start = span === 'all' ? 0 : span.start
  const end = span === 'all' ? info.size - 1 : span.end
  if (span !== 'all') {
    setResponseStatus(event, 206)
    setHeader(event, 'content-range', `bytes ${start}-${end}/${info.size}`)
  }
  setHeader(event, 'content-length', end - start + 1)
  if (event.method === 'HEAD' || info.size === 0) {
    return ''
  }
  return sendStream(event, createReadStream(file, { start, end }))
})
