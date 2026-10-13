import type { H3Event } from 'h3'
import process from 'node:process'
import { db } from '@k39/database'
import { classifyChannel, isBotUserAgent, parseUserAgent, screenBucket, scrollBucket, utmFromPath } from '../../../shared/analytics'
import { analyticsSalt, dailyVisitorKey, newVisitorKey } from './identity'

const SESSION_MS = 30 * 60 * 1000
const YEAR = 60 * 60 * 24 * 400
const TYPES = new Set(['pageview', 'engage', 'outbound', 'photo', 'impression'])

interface ClientEvent {
  type?: string
  path?: string
  ref?: string
  w?: string | number
  lang?: string
  ms?: number
  scroll?: number | string
  target?: string
}

function cookie(event: H3Event, name: string, value: string) {
  setCookie(event, name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: YEAR,
  })
}

async function editorRequest(event: H3Event) {
  try {
    const session = await getUserSession(event)
    const role = session.user?.role
    return role === 'admin' || role === 'editor'
  } catch {
    return false
  }
}

export async function ingest(event: H3Event, incoming: ClientEvent[], source: 'beacon' | 'noscript' | 'server') {
  if (await editorRequest(event)) {
    return { ok: true, skipped: 'admin' }
  }
  const ua = getHeader(event, 'user-agent') || ''
  const parsed = parseUserAgent(ua)
  const bot = parsed.bot || (source === 'server' && !getHeader(event, 'accept-language'))
  const allowVisitorCookie = useRuntimeConfig().public.consentBanner === true && source === 'beacon'
  const consented = allowVisitorCookie && getCookie(event, 'k39_consent') === 'granted'
  const now = Date.now()
  let visitorKey = ''
  let sessionKey = ''
  let mode: 'cookie' | 'daily' = 'daily'
  let landingPath: string | null = null
  let knownChannel = ''
  if (consented) {
    visitorKey = getCookie(event, 'k39_vid') || newVisitorKey()
    const seen = Number(getCookie(event, 'k39_seen') || 0)
    sessionKey = getCookie(event, 'k39_sid') || ''
    if (!sessionKey || !seen || now - seen > SESSION_MS) {
      sessionKey = newVisitorKey()
    }
    cookie(event, 'k39_vid', visitorKey)
    cookie(event, 'k39_sid', sessionKey)
    cookie(event, 'k39_seen', String(now))
    mode = 'cookie'
  } else {
    for (const name of ['k39_vid', 'k39_sid', 'k39_seen']) {
      if (getCookie(event, name)) {
        deleteCookie(event, name, { path: '/' })
      }
    }
    const day = new Date(now).toISOString().slice(0, 10)
    const ip = getRequestIP(event, { xForwardedFor: true }) || ''
    visitorKey = dailyVisitorKey(analyticsSalt(), day, ip, ua)
    const latest = await db.analytics.latestSession(visitorKey)
    const fresh = Boolean(latest && now - new Date(latest.occurredAt).getTime() < SESSION_MS)
    sessionKey = fresh && latest ? latest.sessionKey : newVisitorKey()
    landingPath = fresh && latest ? latest.landingPath : null
    knownChannel = fresh && latest ? latest.channel : ''
  }
  const events = incoming.slice(0, 20).filter((item) => TYPES.has(item.type || ''))
  if (!events.length) {
    return { ok: true, stored: 0 }
  }
  const hasPage = events.some((item) => item.type === 'pageview')
  const seenPage = hasPage ? await db.analytics.sessionHasPageview(sessionKey) : false
  if (hasPage && seenPage) {
    await db.analytics.markExit(sessionKey)
  }
  const rows = []
  let entryTaken = seenPage
  for (const item of events) {
    const path = (item.path || getRequestURL(event).pathname).slice(0, 500)
    const utm = utmFromPath(path)
    const classified = classifyChannel({
      referrer: item.ref || '',
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
    })
    const channel = item.ref ? classified.channel : (knownChannel || classified.channel)
    const subject = item.type === 'pageview' ? await db.analytics.resolvePath(path) : { placeId: null, routeId: null }
    const entry = item.type === 'pageview' && !entryTaken
    if (entry) {
      entryTaken = true
      landingPath = path.split('?')[0] || path
    }
    rows.push({
      visitorKey,
      visitorMode: mode,
      sessionKey,
      consented,
      isBot: bot || isBotUserAgent(ua),
      eventType: item.type || 'pageview',
      path,
      placeId: subject.placeId,
      routeId: subject.routeId,
      referrer: item.ref || null,
      referrerHost: classified.referrerHost || null,
      utmSource: utm.utmSource || null,
      utmMedium: utm.utmMedium || null,
      utmCampaign: utm.utmCampaign || null,
      channel,
      searchQuery: classified.searchQuery || null,
      device: parsed.device,
      browser: parsed.browser,
      os: parsed.os,
      screenBucket: screenBucket(item.w) || null,
      language: (item.lang || getHeader(event, 'accept-language') || '').slice(0, 12) || null,
      landingPath,
      isEntry: entry,
      isExit: item.type === 'pageview',
      engagedMs: item.type === 'engage' ? Math.max(0, Math.round(Number(item.ms) || 0)) : null,
      scrollBucket: item.scroll == null ? null : scrollBucket(item.scroll),
      target: item.target?.slice(0, 300) || null,
    })
  }
  await db.analytics.insertHits(rows)
  return { ok: true, stored: rows.length }
}
