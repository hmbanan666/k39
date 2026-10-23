import type { VueWrapper } from '@vue/test-utils'
import { renderToString } from '@vue/server-renderer'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, reactive, Suspense } from 'vue'
import ListingPage from '../app/pages/zavedeniya/[[...path]].vue'
import { venueAvailabilityFixture } from './fixtures/venue-availability'

const { availability, loadPage } = vi.hoisted(() => ({ availability: vi.fn(), loadPage: vi.fn() }))
const route = reactive({ path: '/zavedeniya/fixture-town', query: {}, params: {}, fullPath: '/zavedeniya/fixture-town' })
vi.mock('../app/composables/fetchPublic', () => ({ fetchPublic: loadPage }))
vi.mock('../app/composables/usePublicHead', () => ({ usePublicHead: vi.fn() }))
vi.mock('./nuxt-stubs', async (original) => ({ ...await original<object>(), useRoute: () => route }))

const mapStub = defineComponent({ name: 'MapEmbed', props: ['hrefs'], render: () => h('div') })
let wrapper: VueWrapper | undefined

beforeEach(() => {
  route.path = '/zavedeniya/fixture-town'
  loadPage.mockResolvedValue(venueAvailabilityFixture())
  availability.mockReset()
  vi.stubGlobal('$fetch', availability)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function renderListing() {
  wrapper = mount(defineComponent({ render: () => h(Suspense, null, { default: () => h(ListingPage) }) }), {
    global: { stubs: { MapEmbed: mapStub } },
  })
  await flushPromises()
  return wrapper
}
function openButton() {
  return wrapper!.get('button.open-now')
}
function cardNames() {
  return wrapper!.findAll('.cards .name').map((card) => card.text())
}
function deferred() {
  let resolve!: (value: { items: Array<{ slug: string }> }) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<{ items: Array<{ slug: string }> }>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const allNames = venueAvailabilityFixture().items.map((item) => item.name)

describe('venue listing availability', () => {
  it.each([
    new TypeError('Failed to fetch'),
    Object.assign(new Error('Service unavailable'), { statusCode: 503 }),
    Object.assign(new Error('Timed out'), { name: 'TimeoutError' }),
  ])('keeps the list on failure, then retries the filter', async (error) => {
    availability.mockRejectedValueOnce(error)
    await renderListing()
    await openButton().trigger('click')
    await flushPromises()
    expect(openButton().attributes('aria-pressed')).toBe('false')
    expect(openButton().attributes('aria-busy')).toBe('false')
    expect(wrapper!.get('[role="alert"]').text()).toContain('показан весь список')
    expect(cardNames()).toEqual(allNames)
    expect(wrapper!.find('.empty').exists()).toBe(false)
    expect(wrapper!.getComponent(mapStub).props('hrefs')).toHaveLength(2)
    expect(availability).toHaveBeenLastCalledWith('/api/public/availability', {
      query: { type: 'venue', status: 'open,closing_soon' }, retry: 0, timeout: 10_000,
    })

    availability.mockResolvedValueOnce({ items: [{ slug: 'fixture-cafe-photo' }] })
    await wrapper!.findAll('button').find((button) => button.text() === 'Повторить')!.trigger('click')
    await flushPromises()
    expect(openButton().attributes('aria-pressed')).toBe('true')
    expect(wrapper!.find('[role="alert"]').exists()).toBe(false)
    expect(cardNames()).toEqual([allNames[0]])
    expect(wrapper!.getComponent(mapStub).props('hrefs')).toEqual(['/zavedeniya/fixture-cafe-photo'])
    await openButton().trigger('click')
    expect(cardNames()).toEqual(allNames)
    expect(wrapper!.getComponent(mapStub).props('hrefs')).toHaveLength(2)
  })

  it('keeps cards and map during loading, then distinguishes a successful empty result', async () => {
    const request = deferred()
    availability.mockReturnValueOnce(request.promise)
    await renderListing()
    await openButton().trigger('click')
    expect(openButton().attributes('aria-busy')).toBe('true')
    expect(wrapper!.get('[role="status"]').text()).toContain('Проверяем')
    expect(cardNames()).toEqual(allNames)
    expect(wrapper!.getComponent(mapStub).props('hrefs')).toHaveLength(2)
    expect(wrapper!.find('.empty').exists()).toBe(false)
    request.resolve({ items: [] })
    await flushPromises()
    expect(cardNames()).toEqual([])
    expect(wrapper!.get('.empty').text()).toContain('нет открытых заведений')
    expect(wrapper!.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper!.find('[role="status"]').exists()).toBe(false)
  })

  it.each(['resolve', 'reject'] as const)('ignores an old %s after off/on', async (settle) => {
    const older = deferred()
    const newer = deferred()
    availability.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    await renderListing()
    await openButton().trigger('click')
    await openButton().trigger('click')
    expect(openButton().attributes('aria-busy')).toBe('false')
    expect(cardNames()).toEqual(allNames)
    await openButton().trigger('click')
    newer.resolve({ items: [{ slug: 'fixture-cafe-plain' }] })
    await flushPromises()
    if (settle === 'resolve') {
      older.resolve({ items: [] })
    } else {
      older.reject(new Error('Late failure'))
    }
    await flushPromises()
    expect(cardNames()).toEqual([allNames[1]])
    expect(openButton().attributes('aria-pressed')).toBe('true')
    expect(wrapper!.find('[role="alert"]').exists()).toBe(false)
  })

  it.each(['resolve', 'reject'] as const)('ignores a late %s after switching off', async (settle) => {
    const request = deferred()
    availability.mockReturnValueOnce(request.promise)
    await renderListing()
    await openButton().trigger('click')
    await openButton().trigger('click')
    if (settle === 'resolve') {
      request.resolve({ items: [] })
    } else {
      request.reject(new Error('Late failure'))
    }
    await flushPromises()
    expect(cardNames()).toEqual(allNames)
    expect(openButton().attributes('aria-pressed')).toBe('false')
    expect(openButton().attributes('aria-busy')).toBe('false')
    expect(wrapper!.find('[role="alert"]').exists()).toBe(false)
  })

  it.each(['resolve', 'reject'] as const)('ignores a late %s after a route change', async (settle) => {
    const request = deferred()
    availability.mockReturnValueOnce(request.promise)
    await renderListing()
    await openButton().trigger('click')
    route.path = '/zavedeniya/fixture-plain'
    await flushPromises()
    if (settle === 'resolve') {
      request.resolve({ items: [] })
    } else {
      request.reject(new Error('Late failure'))
    }
    await flushPromises()
    expect(cardNames()).toEqual(allNames)
    expect(openButton().attributes('aria-pressed')).toBe('false')
    expect(openButton().attributes('aria-busy')).toBe('false')
    expect(wrapper!.find('[role="alert"]').exists()).toBe(false)
  })

  it('settles safely after the listing unmounts', async () => {
    const request = deferred()
    availability.mockReturnValueOnce(request.promise)
    await renderListing()
    await openButton().trigger('click')
    wrapper!.unmount()
    wrapper = undefined
    request.reject(new Error('Late failure'))
    await flushPromises()
    expect(availability).toHaveBeenCalledTimes(1)
  })

  it('renders the unfiltered list on the server without requesting live availability', async () => {
    const html = await renderToString(createSSRApp(ListingPage))
    for (const name of allNames) {
      expect(html).toContain(name)
    }
    expect(html).toContain('aria-pressed="false"')
    expect(html).not.toContain('Проверяем, что открыто')
    expect(availability).not.toHaveBeenCalled()
  })
})
