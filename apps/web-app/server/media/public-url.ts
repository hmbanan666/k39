import { Buffer } from 'node:buffer'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { MAX_UPLOAD_BYTES } from './process'

const USER_AGENT = 'K39/1.0 (https://k39.online; https://github.com/hmbanan666/k39) media-fetch'

function isPrivateAddress(address: string) {
  const value = address.toLowerCase()
  if (value === '::1' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) {
    return true
  }
  const parts = value.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false
  }
  const a = parts[0] ?? -1
  const b = parts[1] ?? -1
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

export async function assertPublicHttps(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Нужен адрес https' })
  }
  if (url.username || url.password) {
    throw createError({ statusCode: 400, statusMessage: 'Адрес с паролем не принимается' })
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw createError({ statusCode: 400, statusMessage: 'Внутренний адрес не принимается' })
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((item) => item.address)
  if (addresses.some((address) => isPrivateAddress(address))) {
    throw createError({ statusCode: 400, statusMessage: 'Внутренний адрес не принимается' })
  }
  return url
}

export async function fetchPublicImage(raw: string) {
  let current = raw
  for (let hop = 0; hop < 3; hop++) {
    await assertPublicHttps(current)
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT },
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        throw createError({ statusCode: 400, statusMessage: 'Редирект без адреса' })
      }
      current = new URL(location, current).toString()
      continue
    }
    if (!response.ok) {
      throw createError({ statusCode: 502, statusMessage: 'Не удалось скачать изображение' })
    }
    const declared = Number(response.headers.get('content-length') || 0)
    if (declared > MAX_UPLOAD_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Файл больше 25 МБ.' })
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > MAX_UPLOAD_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Файл больше 25 МБ.' })
    }
    const mime = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream'
    return { bytes, mime, filename: new URL(current).pathname.split('/').pop() || 'upload' }
  }
  throw createError({ statusCode: 400, statusMessage: 'Слишком много редиректов' })
}
