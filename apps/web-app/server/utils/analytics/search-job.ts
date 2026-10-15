import { Buffer } from 'node:buffer'
import { createSign } from 'node:crypto'
import process from 'node:process'
import { db } from '@k39/database'
import { parseServiceAccountKey } from './gsc-key'

function dayStamp(date: Date) {
  return date.toISOString().slice(0, 10)
}

function b64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

async function googleAccessToken() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON
  if (raw) {
    const key = parseServiceAccountKey(raw)
    const now = Math.floor(Date.now() / 1000)
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claim = b64url(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }))
    const unsigned = `${header}.${claim}`
    const sign = createSign('RSA-SHA256')
    sign.update(unsigned)
    const token = `${unsigned}.${sign.sign(key.private_key).toString('base64url')}`
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token,
      }),
    })
    if (!response.ok) {
      throw new Error(`Google token ${response.status}`)
    }
    const json = await response.json() as { access_token?: string }
    return json.access_token || ''
  }
  const clientId = process.env.GSC_CLIENT_ID
  const clientSecret = process.env.GSC_CLIENT_SECRET
  const refresh = process.env.GSC_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refresh) {
    return ''
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    throw new Error(`Google refresh ${response.status}`)
  }
  const json = await response.json() as { access_token?: string }
  return json.access_token || ''
}

const GOOGLE_PAGE = 5000
const GOOGLE_MAX_ROWS = 50_000
const BACKFILL_DAYS = 90

/**
 * Picks the Search Console property to query. A domain property
 * (`sc-domain:k39.online`) and a URL-prefix property (`https://k39.online/`)
 * are different sites to the API, so a configured URL that the account
 * cannot read falls back to the property on the same host it can read.
 */
export function pickGoogleSite(configured: string, sites: Array<{ siteUrl?: string, permissionLevel?: string }>) {
  const readable = sites
    .filter((site) => site.siteUrl && site.permissionLevel && site.permissionLevel !== 'siteUnverifiedUser')
    .map((site) => site.siteUrl as string)
  if (readable.includes(configured)) {
    return configured
  }
  let host = configured.replace(/^sc-domain:/, '')
  try {
    host = new URL(configured).hostname
  } catch {}
  host = host.replace(/^www\./, '').replace(/\/$/, '')
  return readable.find((site) => site === `sc-domain:${host}`)
    ?? readable.find((site) => {
      try {
        return new URL(site).hostname.replace(/^www\./, '') === host
      } catch {
        return false
      }
    })
    ?? configured
}

async function resolveGoogleSite(token: string, configured: string) {
  const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    return configured
  }
  const json = await response.json() as { siteEntry?: Array<{ siteUrl?: string, permissionLevel?: string }> }
  return pickGoogleSite(configured, json.siteEntry ?? [])
}

async function pullGoogle(from: string, to: string) {
  const configured = process.env.GSC_SITE_URL
  const token = await googleAccessToken()
  if (!configured || !token) {
    return { engine: 'google', skipped: true, rows: 0 }
  }
  const site = await resolveGoogleSite(token, configured)
  const start = (await db.analytics.hasSearchRows('google'))
    ? from
    : dayStamp(new Date(new Date(`${to}T00:00:00Z`).getTime() - BACKFILL_DAYS * 86_400_000))
  let total = 0
  for (let startRow = 0; startRow < GOOGLE_MAX_ROWS; startRow += GOOGLE_PAGE) {
    const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        startDate: start,
        endDate: to,
        dimensions: ['date', 'query', 'page'],
        rowLimit: GOOGLE_PAGE,
        startRow,
      }),
    })
    if (!response.ok) {
      throw new Error(`Search Console ${response.status}`)
    }
    const json = await response.json() as { rows?: Array<{ keys?: string[], clicks?: number, impressions?: number, position?: number }> }
    const page = json.rows ?? []
    const rows = page.flatMap((row) => {
      const [day, query, url] = row.keys ?? []
      if (!day || !query) {
        return []
      }
      return [{
        day,
        engine: 'google',
        page: url || '',
        query,
        impressions: Math.round(row.impressions || 0),
        clicks: Math.round(row.clicks || 0),
        position: row.position ?? null,
      }]
    })
    await db.analytics.replaceSearchRows(rows)
    total += rows.length
    if (page.length < GOOGLE_PAGE) {
      break
    }
  }
  return { engine: 'google', skipped: false, site, from: start, rows: total }
}

async function pullYandex(from: string, to: string) {
  const token = process.env.YANDEX_WEBMASTER_TOKEN
  const hostId = process.env.YANDEX_WEBMASTER_HOST_ID
  if (!token || !hostId) {
    return { engine: 'yandex', skipped: true, rows: 0 }
  }
  const userResponse = await fetch('https://api.webmaster.yandex.net/v4/user', {
    headers: { authorization: `OAuth ${token}` },
  })
  if (!userResponse.ok) {
    throw new Error(`Yandex user ${userResponse.status}`)
  }
  const user = await userResponse.json() as { user_id?: number | string }
  const url = new URL(`https://api.webmaster.yandex.net/v4/user/${user.user_id}/hosts/${encodeURIComponent(hostId)}/search-queries/popular`)
  url.searchParams.set('order_by', 'TOTAL_CLICKS')
  url.searchParams.set('date_from', from)
  url.searchParams.set('date_to', to)
  url.searchParams.append('query_indicator', 'TOTAL_SHOWS')
  url.searchParams.append('query_indicator', 'TOTAL_CLICKS')
  url.searchParams.append('query_indicator', 'AVG_SHOW_POSITION')
  url.searchParams.set('limit', '500')
  const response = await fetch(url, { headers: { authorization: `OAuth ${token}` } })
  if (!response.ok) {
    throw new Error(`Yandex queries ${response.status}`)
  }
  const json = await response.json() as { queries?: Array<{ query_text?: string, indicators?: Record<string, number> }> }
  const day = to
  const rows = (json.queries ?? []).flatMap((item) => {
    if (!item.query_text) {
      return []
    }
    return [{
      day,
      engine: 'yandex',
      page: '',
      query: item.query_text,
      impressions: Math.round(item.indicators?.TOTAL_SHOWS || 0),
      clicks: Math.round(item.indicators?.TOTAL_CLICKS || 0),
      position: item.indicators?.AVG_SHOW_POSITION ?? null,
    }]
  })
  await db.analytics.replaceSearchRows(rows)
  return { engine: 'yandex', skipped: false, rows: rows.length }
}

const SEARCH_DONE = 'search-done'

export async function runAnalyticsMaintenance(now = new Date()) {
  const today = dayStamp(now)
  await db.analytics.purgeRaw(now)
  await db.search.purgeRaw(now)
  const yesterday = dayStamp(new Date(now.getTime() - 86_400_000))
  if (await db.analytics.claimRun(yesterday, 'rollup')) {
    await db.analytics.rollupDay(yesterday)
  }
  // Marked done only after every engine succeeds, so a failed import retries on the next hourly tick.
  if (await db.analytics.hasRun(today, SEARCH_DONE)) {
    return { skipped: true }
  }
  const from = dayStamp(new Date(now.getTime() - 3 * 86_400_000))
  const results = []
  let failed = false
  for (const pull of [pullYandex, pullGoogle]) {
    try {
      results.push(await pull(from, yesterday))
    } catch (error) {
      failed = true
      results.push({ error: error instanceof Error ? error.message : 'search import failed' })
    }
  }
  if (!failed) {
    await db.analytics.claimRun(today, SEARCH_DONE)
  }
  return { skipped: false, failed, results }
}
