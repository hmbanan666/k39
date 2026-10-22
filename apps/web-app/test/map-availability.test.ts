import type { VueWrapper } from '@vue/test-utils'
import type { MapPoint } from '../shared/map'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, Suspense } from 'vue'
import MapPanel from '../app/components/map/MapPanel.vue'
import MapPage from '../app/pages/map/index.vue'

const { availability } = vi.hoisted(() => ({ availability: vi.fn() }))
vi.mock('../app/composables/usePublicHead', () => ({ usePublicHead: vi.fn() }))
vi.mock('../app/composables/useTrack', () => ({ useTrack: () => ({ track: vi.fn() }) }))
vi.mock('../app/composables/fetchPublic', () => ({
  fetchPublic: async () => ({ doc: { h1: 'Карта' }, points, routes: [] }),
}))

function point(id: string, group: 'sight' | 'food', category: string): MapPoint {
  return {
    id, slug: id, title: id === 'fort' ? 'Форт' : 'Кофейня', group, category,
    href: `/${id}`, latitude: 54.7, longitude: 20.5, marker: category,
    church: false, kindLabel: category, summary: '', photo: null, partner: false, stale: false,
  }
}
const points = [point('fort', 'sight', 'forty'), point('coffee', 'food', 'coffee')]
const mapStub = defineComponent({ name: 'K39Map', props: ['points'], render: () => h('div') })
let wrapper: VueWrapper

beforeEach(() => {
  availability.mockReset()
  vi.stubGlobal('$fetch', availability)
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})

async function renderMap(mobile = false) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: mobile })))
  wrapper = mount(defineComponent({ render: () => h(Suspense, null, { default: () => h(MapPage) }) }), {
    global: { stubs: { K39Map: mapStub } },
  })
  await flushPromises()
  const panel = wrapper.getComponent(MapPanel)
  await panel.findAll('button').find((button) => button.text() === 'Достопримечательности')!.trigger('click')
  return panel
}
function openButton() {
  return wrapper.findAll('button').find((button) => button.text() === 'Открыто сейчас')!
}
function mapIds() {
  return (wrapper.getComponent(mapStub).props('points') as MapPoint[]).map((point) => point.id)
}
function deferred() {
  let resolve!: (value: { items: Array<{ type: string, slug: string }> }) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<{ items: Array<{ type: string, slug: string }> }>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe.each([false, true])('map availability (mobile: %s)', (mobile) => {
  it.each([new TypeError('Failed to fetch'), Object.assign(new Error('Service unavailable'), { statusCode: 503 })])('reverts on failure and retries without losing category/search', async (error) => {
    availability.mockRejectedValueOnce(error)
    const panel = await renderMap(mobile)
    panel.vm.$emit('snap', 'peek')
    await wrapper.get('input[type="search"]').setValue('Форт')
    await openButton().trigger('click')
    await flushPromises()
    expect(openButton().attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось проверить')
    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(mapIds()).toEqual(['fort'])
    expect(panel.props('snap')).toBe(mobile ? 'half' : 'peek')
    expect(panel.props('state')).toMatchObject({ category: 'sights', q: 'Форт' })

    availability.mockResolvedValueOnce({ items: [{ type: 'place', slug: 'fort' }] })
    await wrapper.findAll('button').find((button) => button.text() === 'Повторить')!.trigger('click')
    await flushPromises()
    expect(openButton().attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(mapIds()).toEqual(['fort'])
  })

  it('keeps points while loading, then accepts a successful empty response', async () => {
    const request = deferred()
    availability.mockReturnValueOnce(request.promise)
    await renderMap(mobile)
    await openButton().trigger('click')
    expect(mapIds()).toEqual(['fort'])
    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('Проверяем')
    request.resolve({ items: [] })
    await flushPromises()
    expect(openButton().attributes('aria-pressed')).toBe('true')
    expect(mapIds()).toEqual([])
    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it.each(['resolve', 'reject'] as const)('ignores an older %s after off/on and uses current filters', async (settle) => {
    const older = deferred()
    const newer = deferred()
    availability.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const panel = await renderMap(mobile)
    await openButton().trigger('click')
    await openButton().trigger('click')
    await openButton().trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === 'Где поесть')!.trigger('click')
    await wrapper.get('input[type="search"]').setValue('Кофейня')
    newer.resolve({ items: [{ type: 'venue', slug: 'coffee' }] })
    await flushPromises()
    if (settle === 'resolve') {
      older.resolve({ items: [] })
    } else {
      older.reject(new Error('Late failure'))
    }
    await flushPromises()
    expect(openButton().attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(mapIds()).toEqual(['coffee'])
    expect(panel.props('state')).toMatchObject({ category: 'food', q: 'Кофейня' })
  })

  it('ignores a failure after the filter is switched off', async () => {
    const request = deferred()
    availability.mockReturnValueOnce(request.promise)
    await renderMap(mobile)
    await openButton().trigger('click')
    await openButton().trigger('click')
    request.reject(new Error('Late failure'))
    await flushPromises()
    expect(openButton().attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(mapIds()).toEqual(['fort'])
  })
})
