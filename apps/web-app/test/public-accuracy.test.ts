import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import MapPanel from '../app/components/map/MapPanel.vue'
import OpeningLive from '../app/components/OpeningLive.vue'
import RouteGuide from '../app/components/RouteGuide.vue'
import { parseMapQuery } from '../shared/map'
import { routeStopViews } from '../shared/route-nav'
import { scheduleRulesSchema } from '../shared/schedule'
import { renderPage } from './helpers/render-page'

const stops = routeStopViews([
  { href: '/fixture-a', text: 'Фикстура: первая остановка', latitude: 54.7, longitude: 20.5 },
  { href: '/fixture-b', text: 'Фикстура: вторая остановка', latitude: 54.704, longitude: 20.5 },
  { href: '/fixture-c', text: 'Фикстура: последняя остановка', latitude: 54.9, longitude: 20.5 },
])

describe('public accuracy labels', () => {
  it('server-renders route measures and external navigation before the map loads', async () => {
    const html = await renderPage(RouteGuide, { stops, focusHref: '/fixture-route' })
    expect(html).toContain('около 450 м по прямой до следующей')
    expect(html).toContain('около 22 км по прямой до следующей')
    expect(html).toContain('https://yandex.ru/maps/?rtext=')
    expect(html).toContain('https://www.google.com/maps/dir/')
    expect(html.indexOf(stops[0]!.text)).toBeLessThan(html.indexOf(stops[1]!.text))
  })

  it('keeps labelled stops and navigation usable after map failure and mode changes', async () => {
    const wrapper = mount(RouteGuide, { props: { stops, focusHref: '/fixture-route' } })
    try {
      wrapper.getComponent({ name: 'MapEmbed' }).vm.$emit('error')
      await nextTick()
      expect(wrapper.findAll('.cards li')).toHaveLength(3)
      expect(wrapper.findAll('.leg').map((item) => item.text())).toEqual([
        'около 450 м по прямой до следующей',
        'около 22 км по прямой до следующей',
      ])
      await wrapper.get('[role="radio"][value="pd"]').trigger('click')
      expect(wrapper.get('a.go').attributes('href')).toContain('rtt=pd')
      expect(wrapper.findAll('a').find((item) => item.text() === 'В Google Maps')?.attributes('href')).toContain('travelmode=walking')
    } finally {
      wrapper.unmount()
    }
  })

  it.each([false, true])('server-renders straight-line map card distances (mobile: %s)', async (mobile) => {
    const html = await renderPage(MapPanel, {
      points: [{
        id: 'fixture', group: 'sight' as const, slug: 'fixture', title: 'Фикстура', href: '/fixture',
        latitude: 54.704, longitude: 20.5, category: 'forty', marker: 'forty', church: false,
        kindLabel: 'Форт', summary: '', photo: null, partner: false, stale: false,
      }],
      routes: [], state: parseMapQuery({}), selectedId: 'fixture', bounds: null,
      origin: { latitude: 54.7, longitude: 20.5 }, collapsed: false, mobile, snap: 'half' as const,
    })
    expect(html).toContain('440 м по прямой')
  })

  it('uses the same neutral closure text on hydrated compact cards', async () => {
    const wrapper = mount(OpeningLive, {
      props: {
        compact: true,
        schedule: {
          rules: scheduleRulesSchema.parse({ mode: 'closed', closure: { reason: 'other', viewableOutside: true } }),
          sourceUrl: null,
          verifiedAt: '2026-10-14',
        },
      },
    })
    try {
      await nextTick()
      expect(wrapper.text()).toContain('Закрыто')
      expect(wrapper.get('.sub').text()).toBe('снаружи можно посмотреть')
      expect(wrapper.text()).not.toContain('Временно')
      expect(wrapper.classes()).not.toContain('open')
    } finally {
      wrapper.unmount()
    }
  })
})
