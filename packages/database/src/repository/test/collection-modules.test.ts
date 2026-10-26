import { describe, expect, it } from 'vitest'
import { Editor } from '../content'

describe('collection_save module page', () => {
  it('stores a module page that is already in the database', async () => {
    await Editor.savePlace({
      slug: 'module-page-stop',
      title: 'Остановка модулей',
      summary: 'Точка для проверки сохранения модулей.',
      body: 'Фикстура.',
      publicationStatus: 'published',
      status: 'unknown',
      sources: [],
    })
    const modules = [
      { type: 'text', variant: 'lead', text: 'Лид модульной страницы.' },
      {
        type: 'month-stats',
        title: 'Месяц',
        tiles: [
          { label: 'А', value: '1' },
          { label: 'Б', value: '2' },
        ],
        rows: [],
      },
      { type: 'picker', questions: ['interest'] },
      { type: 'ideas', title: 'Идеи', items: [{ title: 'Одна', text: 'Текст идеи.', tags: ['eda'] }] },
      { type: 'plans', title: 'План', items: [{ title: 'День', text: 'Текст плана.', tags: [] }] },
      { type: 'places', title: 'Места' },
      { type: 'months', title: 'Месяцы' },
    ]
    const saved = await Editor.saveCollection({
      slug: 'module-page-save',
      title: 'Модульная страница',
      summary: 'Проверка collection_save.',
      body: 'Лид модульной страницы.',
      publicationStatus: 'published',
      items: [{ placeSlug: 'module-page-stop' }],
      modules,
    })
    const again = await Editor.saveCollection({
      id: saved.id,
      slug: 'module-page-save',
      title: 'Модульная страница',
      modules,
    })
    expect(again.id).toBe(saved.id)
    expect(again.modules?.map((module) => module.type)).toEqual([
      'text',
      'month-stats',
      'picker',
      'ideas',
      'plans',
      'places',
      'months',
    ])
    const items = await Editor.collectionItems(saved.id)
    expect(items.map((item) => item.placeSlug)).toEqual(['module-page-stop'])
  })
})
