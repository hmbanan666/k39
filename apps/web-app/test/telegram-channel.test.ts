import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import SiteFooter from '../app/components/SiteFooter.vue'
import TelegramChannel from '../app/components/TelegramChannel.vue'
import ReaderLayout from '../app/components/reader/ReaderLayout.vue'
import { TELEGRAM_CHANNEL_URL } from '../shared/seo'
import { renderPage } from './helpers/render-page'

const appRoot = join(import.meta.dirname, '..')
const NOTE = 'Новые места и маршруты выходят в нашем канале.'
const LABEL = 'Наш Telegram-канал'

function filesWithUrl(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.nuxt' || name === '.output') {
      continue
    }
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      found.push(...filesWithUrl(path))
      continue
    }
    if (!/\.(vue|ts|mjs|css|json|md)$/.test(name)) {
      continue
    }
    if (readFileSync(path, 'utf8').includes('https://t.me/k39_online')) {
      found.push(relative(appRoot, path))
    }
  }
  return found
}

function expectChannelLink(html: string) {
  expect(html).toContain(`href="${TELEGRAM_CHANNEL_URL}"`)
  expect(html).toContain('target="_blank"')
  expect(html).toContain('rel="noopener"')
  expect(html).not.toContain('nofollow')
  expect(html).toContain(LABEL)
}

describe('telegram channel', () => {
  it('keeps the channel URL in one constant', () => {
    expect(TELEGRAM_CHANNEL_URL).toBe('https://t.me/k39_online')
    expect(filesWithUrl(appRoot).sort()).toEqual(['shared/seo.ts', 'test/telegram-channel.test.ts'])
  })

  it('renders the footer label on its own', async () => {
    const html = await renderPage(SiteFooter, {})
    expectChannelLink(html)
    expect(html).not.toContain(NOTE)
    expect(html.match(/k39_online/g)).toHaveLength(1)
  })

  it('renders one article note after the main text', async () => {
    const html = await renderPage(ReaderLayout, { html: '<p>Текст места.</p><h2>Дальше</h2><p>Ещё.</p>' })
    expectChannelLink(html)
    expect(html).toContain(NOTE)
    expect(html.indexOf('Текст места.')).toBeLessThan(html.indexOf(NOTE))
    expect(html.indexOf('Дальше')).toBeLessThan(html.indexOf(NOTE))
    expect(html.match(/k39_online/g)).toHaveLength(1)
  })

  it('uses the same link for the note and the footer label', async () => {
    const note = await renderPage(TelegramChannel, {})
    const link = await renderPage(TelegramChannel, { variant: 'link' })
    expectChannelLink(note)
    expect(note).toContain(NOTE)
    expectChannelLink(link)
    expect(link).not.toContain(NOTE)
  })

  it('mounts the shared note on every content article shell', () => {
    const read = (path: string) => readFileSync(join(appRoot, path), 'utf8')
    expect(read('app/components/reader/ReaderLayout.vue')).toContain('<TelegramChannel')
    for (const path of [
      'app/pages/[slug].vue',
      'app/pages/marshruty/[slug].vue',
      'app/pages/podborki/[slug].vue',
      'app/components/VenuePage.vue',
      'app/components/HubPage.vue',
    ]) {
      expect(read(path)).toContain('<ReaderLayout')
    }
    expect(read('app/pages/kvesty/[slug].vue')).toContain('<TelegramChannel')
    expect(read('app/components/SiteFooter.vue')).toContain('<TelegramChannel variant="link"')
  })
})
