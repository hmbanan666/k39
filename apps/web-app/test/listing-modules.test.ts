import { describe, expect, it } from 'vitest'
import { attachSituationCards, listingModulesSchema, toPublicListingModules } from '../shared/listing-modules'

const render = (text: string) => `<p>${text}</p>`

describe('listing modules', () => {
  it('renders the five blocks and keeps situation slugs for later cards', () => {
    const stored = [
      { type: 'choose', text: 'Как устроена еда в городе.' },
      { type: 'situation', items: [{ label: 'С детьми', placeSlug: 'kafe-promenad', icon: 'kids' }] },
      { type: 'areas', items: [{ name: 'Променад', text: 'Кафе у моря.' }] },
      { type: 'season', items: [{ when: 'Лето', text: 'Террасы открыты.' }] },
      { type: 'faq', items: [{ question: 'Где поесть?', answer: 'Смотрите карточки.' }] },
    ]
    expect(listingModulesSchema.safeParse(stored).success).toBe(true)
    const blocks = toPublicListingModules(stored, render)
    expect(blocks.map((block) => block.title)).toEqual(['Как выбрать', 'По ситуации', 'Районы и улицы', 'Сезонность', 'Вопросы'])
    const situation = blocks.find((block) => block.type === 'situation')
    expect(situation?.type === 'situation' && situation.items[0]?.placeSlug).toBe('kafe-promenad')
  })

  it('drops a missing venue and an empty situation block', () => {
    const blocks = toPublicListingModules([
      { type: 'situation', items: [{ label: 'Завтрак', placeSlug: 'net-takogo' }] },
      { type: 'choose', text: 'Короткий гид.' },
    ], render)
    const ready = attachSituationCards(blocks, new Map())
    expect(ready.map((block) => block.type)).toEqual(['choose'])
  })

  it('rejects a second copy of one module and an empty season', () => {
    expect(listingModulesSchema.safeParse([
      { type: 'faq', items: [{ question: 'А?', answer: 'Б.' }] },
      { type: 'faq', items: [{ question: 'В?', answer: 'Г.' }] },
    ]).success).toBe(false)
    expect(listingModulesSchema.safeParse([{ type: 'season' }]).success).toBe(false)
    expect(listingModulesSchema.safeParse([]).success).toBe(true)
  })
})
