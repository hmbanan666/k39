import { bodyFingerprint, bodyOf, composeBody, splitBody } from '@k39/database'
import { describe, expect, it } from 'vitest'

const body = `Вступление.

## История

Текст.

### Подраздел

Ещё.

## Практика

Совет.

## Как добраться

Автобус.`

describe('body sections', () => {
  it('splits on h2 and maps standard headings', () => {
    const sections = splitBody(body)
    expect(sections.map((s) => s.kind)).toEqual(['text', 'text', 'useful', 'directions'])
    expect(sections[1]).toEqual({ kind: 'text', title: 'История', text: 'Текст.\n\n### Подраздел\n\nЕщё.' })
  })

  it('composes standard titles from the registry, text verbatim', () => {
    const composed = composeBody(splitBody(body))
    expect(composed).toContain('## Полезно знать\n\nСовет.')
    expect(bodyFingerprint(composed)).toBe(bodyFingerprint(body.replace('## Практика', '## Полезно знать')))
  })

  it('ignores headings inside code fences', () => {
    expect(splitBody('a\n\n```\n## no\n```')).toHaveLength(1)
  })

  it('renders the body from sections when present', () => {
    expect(bodyOf({ body: 'old', sections: [{ kind: 'useful', text: 'x' }] })).toBe('## Полезно знать\n\nx')
    expect(bodyOf({ body: 'old', sections: [] })).toBe('old')
  })
})
