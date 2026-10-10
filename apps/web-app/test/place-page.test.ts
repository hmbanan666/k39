import type { PlacePageModel } from '../app/utils/place-page'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlaceView from '../app/components/place/PlaceView.vue'
import { touristAttraction } from '../app/utils/place-page'

const place: PlacePageModel = {
  title: 'Форт № 11 «Дёнхофф»',
  description: 'Частный музей на юго-востоке Калининграда.',
  slug: 'fort-11-denhoff',
  placeType: 'fort',
  status: 'open',
  statusLabel: 'Частный музей',
  hours: '10:00-18:00',
  lat: 54.656847,
  lon: 20.567554,
  sourceName: 'Википедия',
  sourceUrl: 'https://ru.wikipedia.org/wiki/fort-11',
  how: 'Юго-восток города.',
  mapId: 'f11',
  region: 'kaliningrad',
}

describe('place page', () => {
  it('renders a place page', () => {
    const wrapper = mount(PlaceView, {
      props: { place },
      slots: { default: '<p>Построен в 1877-1881 годах.</p>' },
    })

    expect(wrapper.text()).toContain('Форт № 11 «Дёнхофф»')
    expect(wrapper.text()).toContain('Частный музей')
    expect(wrapper.text()).toContain('10:00-18:00')
    expect(wrapper.text()).toContain('Построен в 1877-1881 годах.')
    expect(wrapper.get('a[href="https://ru.wikipedia.org/wiki/fort-11"]').text()).toBe('Википедия')
    expect(wrapper.text()).not.toMatch(/[—–]/)
  })

  it('describes the place as a TouristAttraction', () => {
    const schema = touristAttraction(place)
    expect(schema['@type']).toBe('TouristAttraction')
    expect(schema.name).toBe(place.title)
    expect(schema.url).toBe('https://k39.online/place/fort-11-denhoff')
    expect(schema.geo).toEqual({
      '@type': 'GeoCoordinates',
      'latitude': place.lat,
      'longitude': place.lon,
    })
  })
})
