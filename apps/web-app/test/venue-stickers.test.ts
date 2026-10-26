import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VenueModules from '../app/components/VenueModules.vue'

const stubs = {
  Sticker: {
    props: ['slug'],
    template: '<i class="stub-sticker" :data-slug="slug" />',
  },
  Icon: true,
  UiLink: true,
  MetaLink: true,
  ProseHtml: { props: ['html'], template: '<div v-html="html" />' },
}

describe('venue module stickers', () => {
  it('shows the heart sticker whenever the audience module renders', () => {
    const wrapper = mount(VenueModules, {
      props: {
        blocks: [
          {
            type: 'audience',
            id: 'komu-podoydet',
            title: 'Кому подойдёт',
            items: [{ who: 'Семья', icon: 'family', html: '<p>С детьми.</p>' }],
          },
          {
            type: 'tips',
            id: 'sovety',
            title: 'Советы',
            items: ['Берите стол у окна.'],
          },
        ],
      },
      global: { stubs },
    })
    const stickers = wrapper.findAll('.stub-sticker')
    expect(stickers).toHaveLength(1)
    expect(stickers[0]?.attributes('data-slug')).toBe('with-heart')
    expect(wrapper.get('#komu-podoydet h2').classes()).toContain('with-sticker')
    expect(wrapper.get('#sovety h2').classes()).not.toContain('with-sticker')
  })

  it('does not let the page hide module stickers', () => {
    const modules = readFileSync(resolve(__dirname, '../app/components/VenueModules.vue'), 'utf8')
    const page = readFileSync(resolve(__dirname, '../app/components/VenuePage.vue'), 'utf8')
    expect(modules).not.toContain('audienceSticker')
    expect(page).not.toContain('audience-sticker')
    expect(page).not.toContain('directionsSticker')
    expect(page).not.toContain('Boolean(cover)')
    expect(page).toContain('slug="with-map"')
    expect(page).toContain('v-if="howToGetHtml"')
    expect(page).toContain('const showDirections = Boolean(howToGetHtml) || hasCoords')
    expect(page).toContain('slug="with-smartphone"')
    expect(page).toContain(':slug="heroSticker"')
  })
})
