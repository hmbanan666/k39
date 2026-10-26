import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EatNowPage from '../app/components/EatNowPage.vue'
import { eatNowLocationFixture } from './fixtures/eat-now-location'
import { renderPage } from './helpers/render-page'

vi.mock('../app/composables/usePublicHead', () => ({ usePublicHead: vi.fn() }))
const geolocate = vi.fn<Geolocation['getCurrentPosition']>()
let wrapper: VueWrapper | undefined
beforeEach(() => {
  geolocate.mockReset()
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: geolocate } })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})
async function renderTown(page = eatNowLocationFixture()) {
  wrapper = mount(EatNowPage, { props: { page } })
  await flushPromises()
  return wrapper
}
function button() {
  return wrapper!.get('.tools button')
}
function names() {
  return wrapper!.findAll('.name').map((node) => node.text())
}
function distances() {
  return wrapper!.findAll('.dist').map((node) => node.text())
}
async function rejectLocation(code: number) {
  geolocate.mock.calls.at(-1)![1]!({ code } as GeolocationPositionError)
  await flushPromises()
}
async function acceptLocation() {
  geolocate.mock.calls.at(-1)![0]({ coords: { latitude: 54.71, longitude: 20.51 } } as GeolocationPosition)
  await flushPromises()
}

describe('eat-now geolocation', () => {
  it.each([
    [1, 'запрещён'],
    [2, 'Попробуйте ещё раз'],
    [3, '10 секунд'],
  ] as const)('keeps centre results after error %s and retries successfully', async (code, text) => {
    await renderTown()
    const initialNames = names()
    const initialDistances = distances()
    expect(geolocate).not.toHaveBeenCalled()
    await button().trigger('click')
    expect(button().attributes('disabled')).toBeDefined()
    expect(button().attributes('aria-busy')).toBe('true')
    expect(wrapper!.get('[role="status"]').text()).toContain('Определяем')
    expect(names()).toEqual(initialNames)
    expect(geolocate.mock.calls[0]![2]).toEqual({ maximumAge: 300_000, timeout: 10_000 })
    await rejectLocation(code)
    expect(wrapper!.get('[role="alert"]').text()).toContain(text)
    expect(wrapper!.get('.tools .note').text()).toContain('от центра')
    expect(names()).toEqual(initialNames)
    expect(distances()).toEqual(initialDistances)
    expect(button().text()).toBe('Повторить')
    expect(button().attributes('disabled')).toBeUndefined()
    await button().trigger('click')
    expect(wrapper!.find('[role="alert"]').exists()).toBe(false)
    await acceptLocation()
    expect(wrapper!.get('.tools .note').text()).toContain('от вас')
    expect(names()[0]).toBe('Фикстура: кафе на площади')
    expect(wrapper!.get('.dist').text()).toContain('10 м')
    expect(
      wrapper!
        .findAll('.card')
        .find((card) => card.text().includes('без координат'))!
        .find('.dist')
        .exists(),
    ).toBe(false)
    expect(button().text()).toBe('Обновить моё место')
  })

  it('keeps the last successful position if a refresh fails', async () => {
    await renderTown()
    await button().trigger('click')
    await acceptLocation()
    const previousDistances = distances()
    const previousNames = names()
    await button().trigger('click')
    await rejectLocation(3)
    expect(wrapper!.get('[role="alert"]').text()).toContain('прежнее местоположение')
    expect(wrapper!.get('.tools .note').text()).toContain('от вас')
    expect(distances()).toEqual(previousDistances)
    expect(names()).toEqual(previousNames)
  })

  it.each([undefined, {}])('explains missing geolocation support without a dead button: %j', async (geolocation) => {
    vi.stubGlobal('navigator', { geolocation })
    await renderTown()
    expect(wrapper!.get('[role="alert"]').text()).toContain('В этом браузере нельзя')
    expect(wrapper!.find('.tools button').exists()).toBe(false)
    expect(names()).toHaveLength(3)
    expect(geolocate).not.toHaveBeenCalled()
  })

  it('recovers if the browser throws instead of calling the error callback', async () => {
    geolocate.mockImplementationOnce(() => {
      throw new Error('Security policy')
    })
    await renderTown()
    await button().trigger('click')
    expect(wrapper!.get('[role="alert"]').text()).toContain('Попробуйте ещё раз')
    expect(button().attributes('disabled')).toBeUndefined()
    expect(names()).toHaveLength(3)
  })

  it('does not claim centre distances when the town has no centre or venue coordinates', async () => {
    const page = eatNowLocationFixture()
    page.centre = null
    page.items = page.items.map((item) => ({
      ...item,
      latitude: null,
      longitude: null,
      distanceKm: null,
      distance: '',
    }))
    await renderTown(page)
    expect(wrapper!.get('.tools .note').text()).toBe('Расстояния пока не определены.')
    expect(distances()).toEqual([])
    expect(names()).toHaveLength(3)
  })

  it.each(['success', 'failure'] as const)('ignores a late %s after a town change', async (settle) => {
    await renderTown()
    await button().trigger('click')
    const page = eatNowLocationFixture()
    page.town = { ...page.town, slug: 'fixture-other' }
    await wrapper!.setProps({ page })
    if (settle === 'success') {
      await acceptLocation()
    } else {
      await rejectLocation(1)
    }
    expect(wrapper!.get('.tools .note').text()).toContain('от центра')
    expect(wrapper!.find('[role="alert"]').exists()).toBe(false)
    expect(button().attributes('disabled')).toBeUndefined()
  })

  it('settles safely after unmount', async () => {
    await renderTown()
    await button().trigger('click')
    wrapper!.unmount()
    wrapper = undefined
    await acceptLocation()
    await rejectLocation(1)
    expect(geolocate).toHaveBeenCalledTimes(1)
  })

  it('renders useful centre results without touching browser location on the server', async () => {
    const html = await renderPage(EatNowPage, { page: eatNowLocationFixture() })
    expect(html).toContain('Расстояние от центра')
    expect(html).toContain('Фикстура: кафе на площади')
    expect(html).not.toContain('Определяем местоположение')
    expect(html).not.toContain('В этом браузере нельзя')
    expect(geolocate).not.toHaveBeenCalled()
  })
})
