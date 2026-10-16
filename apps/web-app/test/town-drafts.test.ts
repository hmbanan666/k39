import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { composeBody } from '@k39/database'
import { describe, expect, it } from 'vitest'
import { articleBody } from '../shared/address'
import { pageTitle } from '../shared/seo'
import { WRITING_BANNED_SITES, writingHits } from '../shared/writing'

const draftsDir = resolve(import.meta.dirname, '../../../content/drafts/towns')

interface DraftSection {
  kind: 'text' | 'useful' | 'directions'
  title?: string
  text: string
}

interface DraftFaq {
  question: string
  answer: string
}

interface DraftSource {
  title: string
  url: string
}

interface Draft {
  slug: string
  title: string
  summary: string
  sections: DraftSection[]
  faq: DraftFaq[]
  bestTime: string
  visitDuration: string
  howToGet: string
  seoTitle: string
  seoDescription: string
  sources: DraftSource[]
  factsCheckedAt: string
  notes: string[]
  sourcedShort?: boolean
  proposed?: boolean
  passport?: {
    lengthOverride?: unknown
    personas?: Array<{ code: string, primary: boolean }>
  }
}

function loadDrafts(): Draft[] {
  return readdirSync(draftsDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(resolve(draftsDir, name), 'utf8')) as Draft)
}

function stringsOf(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    found.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) {
      stringsOf(item, found)
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      stringsOf(item, found)
    }
  }
  return found
}

function articleOf(draft: Draft) {
  return articleBody(draft.summary, composeBody(draft.sections), draft.howToGet).trim()
}

describe('town drafts', () => {
  const drafts = loadDrafts()

  it('covers the town set and does not add a Kaliningrad city page', () => {
    expect(drafts.map((draft) => draft.slug).sort()).toEqual([
      'bagrationovsk',
      'baltiysk',
      'chernyakhovsk',
      'guryevsk',
      'gusev',
      'gvardeysk',
      'mamonovo',
      'neman',
      'pionerskii',
      'polessk',
      'pravdinsk',
      'sovetsk',
      'svetlogorsk',
      'yantarnyy',
      'zelenogradsk',
    ])
  })

  it('runs every string through the stop-list', () => {
    for (const draft of drafts) {
      const hits = writingHits(stringsOf(draft).join('\n'))
      expect(hits, draft.slug).toEqual([])
      const blob = stringsOf(draft).join('\n').toLowerCase()
      for (const site of WRITING_BANNED_SITES) {
        expect(blob, draft.slug).not.toContain(site)
      }
    }
  })

  it('checks length, faq count, and the search window', () => {
    for (const draft of drafts) {
      const article = articleOf(draft)
      if (draft.sourcedShort) {
        expect(article.length, draft.slug).toBeGreaterThanOrEqual(400)
        expect(article.length, draft.slug).toBeLessThan(2000)
        expect(draft.notes.join('\n'), draft.slug).toContain('Короткий черновик')
      } else {
        expect(article.length, draft.slug).toBeGreaterThanOrEqual(2000)
        expect(article.length, draft.slug).toBeLessThanOrEqual(6000)
      }
      expect(draft.faq.length, draft.slug).toBeGreaterThanOrEqual(3)
      expect(draft.faq.length, draft.slug).toBeLessThanOrEqual(6)
      const title = pageTitle(draft.title, draft.seoTitle)
      expect(title.length, `${draft.slug} ${title}`).toBeGreaterThanOrEqual(30)
      expect(title.length, `${draft.slug} ${title}`).toBeLessThanOrEqual(65)
      expect(draft.seoDescription.length, draft.slug).toBeGreaterThanOrEqual(110)
      expect(draft.seoDescription.length, draft.slug).toBeLessThanOrEqual(160)
    }
  })

  it('keeps the place shape from ADR 0020 and 0027', () => {
    for (const draft of drafts) {
      expect(draft.visitDuration.trim(), draft.slug).not.toBe('')
      expect(draft.bestTime.trim(), draft.slug).not.toBe('')
      expect(draft.howToGet.length, draft.slug).toBeLessThanOrEqual(80)
      expect(draft.howToGet, draft.slug).not.toContain('\n')
      expect(draft.factsCheckedAt, draft.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(draft.sources.length, draft.slug).toBeGreaterThan(0)
      for (const source of draft.sources) {
        expect(source.title.trim(), draft.slug).not.toBe('')
        expect(source.url, draft.slug).toMatch(/^https:\/\//)
      }
      const kinds = draft.sections.map((section) => section.kind)
      expect(kinds, draft.slug).toContain('directions')
      expect(kinds.every((kind) => kind === 'text' || kind === 'useful' || kind === 'directions'), draft.slug).toBe(true)
      const article = articleOf(draft)
      expect(article, draft.slug).not.toContain('Частые вопросы')
      expect(article.startsWith(draft.summary), draft.slug).toBe(false)
      for (const item of draft.faq) {
        expect(item.question.endsWith('?'), draft.slug).toBe(true)
        expect(item.answer.trim(), draft.slug).not.toBe('')
      }
    }
  })

  it('fills the gaps named for each town', () => {
    const bySlug = new Map(drafts.map((draft) => [draft.slug, draft]))
    for (const slug of ['gusev', 'polessk', 'yantarnyy']) {
      expect(bySlug.get(slug)?.sections.some((section) => section.kind === 'useful'), slug).toBe(true)
    }
    for (const slug of ['pionerskii', 'yantarnyy']) {
      expect(bySlug.get(slug)?.sections.some((section) => section.title === 'Пляж'), slug).toBe(true)
    }
    expect(bySlug.get('yantarnyy')?.sections.some((section) => section.text.includes('/plyazhi-yantarnogo'))).toBe(true)
    expect(bySlug.get('chernyakhovsk')?.sections.some((section) => section.title === 'Еда и ночлег')).toBe(true)
    for (const slug of ['svetlogorsk', 'zelenogradsk', 'baltiysk']) {
      expect(bySlug.get(slug)?.visitDuration.trim(), slug).not.toBe('')
    }
    for (const slug of ['neman', 'gvardeysk', 'guryevsk', 'bagrationovsk']) {
      const draft = bySlug.get(slug)
      expect(draft?.proposed, slug).toBe(true)
      expect(draft?.passport, slug).toBeTruthy()
      expect(draft?.passport?.lengthOverride, slug).toBeUndefined()
      expect(draft?.passport?.personas?.filter((persona) => persona.primary)).toHaveLength(1)
    }
  })
})
