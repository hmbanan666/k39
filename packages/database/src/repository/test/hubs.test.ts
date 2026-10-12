import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { categories } from '../../tables'
import { Content, Editor } from '../content'

describe('hub body', () => {
  beforeEach(async () => {
    await useDatabase().delete(categories).where(eq(categories.slug, 'hub-body'))
  })

  it('stores markdown body and leaves omitted SEO fields in place', async () => {
    const db = useDatabase()
    const [created] = await db.insert(categories).values({
      slug: 'hub-body',
      title: 'Форты',
      description: 'Коротко о фортах.',
      seoTitle: 'Форты Калининграда',
      seoDescription: 'Описание для поиска, длиннее пятидесяти знаков.',
    }).returning()
    if (!created) {
      throw new Error('category insert failed')
    }
    const saved = await Editor.saveCategory(created.id, {
      title: 'Форты',
      description: 'Коротко о фортах.',
      body: '## Частые вопросы\n\n**Можно ли зайти?** Смотрите статус на странице форта.',
    })
    expect(saved?.body).toContain('Частые вопросы')
    expect(saved?.seoTitle).toBe('Форты Калининграда')

    const renamed = await Editor.saveCategory(created.id, {
      title: 'Форты кольца',
      description: 'Коротко о фортах.',
      seoTitle: null,
    })
    expect(renamed?.title).toBe('Форты кольца')
    expect(renamed?.body).toContain('Частые вопросы')
    expect(renamed?.seoTitle).toBeNull()
    expect(renamed?.seoDescription).toContain('Описание для поиска')

    const loaded = await Content.categoryBySlug('hub-body')
    expect(loaded?.body).toContain('**Можно ли зайти?**')
  })
})
