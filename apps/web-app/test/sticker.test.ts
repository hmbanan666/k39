import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { renderToString } from '@vue/server-renderer'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import Sticker from '../app/components/Sticker.vue'
import { FOOD_STICKERS, foodStickerSrc, foodStickerSrcset, isFoodStickerSlug } from '../shared/food-stickers'
import { STICKER_CATEGORY, STICKERS, stickerSrc, stickerSrcset } from '../shared/stickers'

describe('sticker picture', () => {
  it('renders a moose sticker with the catalog picture and leaves food paths unused', () => {
    const wrapper = mount(Sticker, { props: { slug: 'with-map' } })
    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe(stickerSrc('with-map', 256, 'png'))
    expect(img.attributes('src')).not.toContain('/stickers/food/')
    expect(img.attributes('alt')).toBe(STICKERS['with-map'].alt)
    expect(img.attributes('width')).toBe('160')
    expect(img.attributes('height')).toBe(
      String(Math.round((160 * STICKERS['with-map'].height) / STICKERS['with-map'].width)),
    )
    expect(img.attributes('loading')).toBe('lazy')
    const avif = wrapper.get('source[type="image/avif"]')
    expect(avif.attributes('srcset')).toBe(stickerSrcset('with-map', 'avif'))
    expect(avif.attributes('sizes')).toBe('160px')
    expect(wrapper.get('source[type="image/webp"]').attributes('srcset')).toBe(stickerSrcset('with-map', 'webp'))
  })

  it('keeps a moose sticker decorative when the nearby text already says it', () => {
    const wrapper = mount(Sticker, { props: { slug: 'with-map', decorative: true, priority: true, width: 72 } })
    const img = wrapper.get('img')
    expect(img.attributes('alt')).toBe('')
    expect(img.attributes('loading')).toBe('eager')
    expect(img.attributes('fetchpriority')).toBe('high')
    expect(wrapper.get('source[type="image/webp"]').attributes('sizes')).toBe('72px')
  })

  it('renders a food sticker through the same picture, sized for a price card', () => {
    const wrapper = mount(Sticker, {
      props: { set: 'food', slug: 'latte', width: 56, decorative: true },
    })
    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe(foodStickerSrc('latte', 256, 'png'))
    expect(img.attributes('alt')).toBe('')
    expect(img.attributes('width')).toBe('56')
    expect(img.attributes('height')).toBe(
      String(Math.round((56 * FOOD_STICKERS.latte.height) / FOOD_STICKERS.latte.width)),
    )
    const avif = wrapper.get('source[type="image/avif"]')
    expect(avif.attributes('srcset')).toBe(foodStickerSrcset('latte', 'avif'))
    expect(avif.attributes('srcset')).toContain('/stickers/food/latte-128.avif 128w')
    expect(avif.attributes('srcset')).toContain('/stickers/food/latte-256.avif 256w')
    expect(avif.attributes('srcset')).toContain('/stickers/food/latte-512.avif 512w')
    expect(avif.attributes('sizes')).toBe('56px')
    expect(wrapper.get('source[type="image/webp"]').attributes('srcset')).toBe(foodStickerSrcset('latte', 'webp'))
    expect(img.attributes('src')).not.toBe('/stickers/latte-256.png')
  })

  it('uses the food catalog alt when the sticker is not decorative', () => {
    const wrapper = mount(Sticker, { props: { set: 'food', slug: 'borscht', width: 64 } })
    expect(wrapper.get('img').attributes('alt')).toBe(FOOD_STICKERS.borscht.alt)
    const named = mount(Sticker, { props: { set: 'food', slug: 'borscht', alt: 'Своя подпись' } })
    expect(named.get('img').attributes('alt')).toBe('Своя подпись')
  })

  it('prints the food picture in server HTML', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => h(Sticker, { set: 'food', slug: 'cappuccino', width: 56, decorative: true }),
      }),
    )
    expect(html).toContain('src="/stickers/food/cappuccino-256.png"')
    expect(html).toContain('/stickers/food/cappuccino-128.avif 128w')
    expect(html).toContain('/stickers/food/cappuccino-256.webp 256w')
    expect(html).toContain('/stickers/food/cappuccino-512.avif 512w')
    expect(html).toContain('sizes="56px"')
    expect(html).toContain('alt width="56"')
    expect(html).not.toContain(FOOD_STICKERS.cappuccino.alt)
    expect(html).not.toContain('/stickers/cappuccino-256.png')
  })

  it('knows every food catalog slug and refuses one from the moose set', () => {
    expect(isFoodStickerSlug('cappuccino')).toBe(true)
    expect(isFoodStickerSlug('with-map')).toBe(false)
    expect(Object.keys(FOOD_STICKERS).every((slug) => isFoodStickerSlug(slug))).toBe(true)
    expect(() => mount(Sticker, { props: { set: 'food', slug: 'with-map' as 'borscht' } })).toThrow(
      /Unknown food sticker/,
    )
  })

  it('lists every moose sticker once in the catalog, with its category', () => {
    const catalog = readFileSync(join(process.cwd(), 'docs/stickers.md'), 'utf8')
    for (const slug of Object.keys(STICKERS) as Array<keyof typeof STICKERS>) {
      const rows = catalog.split('\n').map((line) => line.split('|').map((cell) => cell.trim()))
      const matches = rows.filter((cells) => cells[1] === `\`${slug}\``)
      expect(matches, slug).toHaveLength(1)
      expect(matches[0]?.[2]).toBe(STICKER_CATEGORY[slug])
    }
  })
})
