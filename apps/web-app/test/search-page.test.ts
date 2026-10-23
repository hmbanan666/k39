import type { VueWrapper } from '@vue/test-utils'
import type { SearchResponse } from '../shared/search'
import { renderToString } from '@vue/server-renderer'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, reactive, ref, Suspense } from 'vue'
import SearchPage from '../app/pages/poisk.vue'

const { fetchPage, sendEvents } = vi.hoisted(() => ({ fetchPage: vi.fn(), sendEvents: vi.fn() }))
vi.mock('./nuxt-stubs', async (original) => ({
  ...await original<object>(),
  useRoute: () => route,
  useFetch: fetchPage,
}))
vi.mock('../shared/search', async (original) => ({ ...await original<object>(), sendSearchEvents: sendEvents }))

const route = reactive({ query: { q: 'Форт', s: 'header' } })
const data = ref<SearchResponse | null>(null)
const status = ref<'idle' | 'pending' | 'success' | 'error'>('error')
const error = ref<Error | null>(null)
const refresh = vi.fn()
let wrapper: VueWrapper | undefined

function response(query = 'Форт', empty = false): SearchResponse {
  return { query, normalized: query.toLowerCase(), results: empty
    ? []
    : [{
        kind: 'place', path: '/fixture-fort', title: 'Фикстура: форт',
        label: 'Форты', region: 'Калининград', snippet: 'Тестовый результат',
      }] }
}
async function renderPage() {
  wrapper = mount(defineComponent({ render: () => h(Suspense, null, { default: () => h(SearchPage) }) }))
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  route.query = { q: 'Форт', s: 'header' }
  data.value = null
  status.value = 'error'
  error.value = new TypeError('Failed to fetch')
  refresh.mockReset()
  sendEvents.mockReset()
  fetchPage.mockImplementation((url: string) => url === '/api/search'
    ? { data, status, error, refresh }
    : { data: ref({ hubs: [{ text: 'Форты', href: '/forty' }], places: [], routes: [] }) })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

it('shows a recoverable failure instead of an empty search and does not log it', async () => {
  const page = await renderPage()
  expect(page.get('[role="alert"]').text()).toContain('Не удалось выполнить поиск')
  expect(page.text()).not.toContain('ничего не нашлось')
  expect(page.get('input[name="q"]').element.getAttribute('value')).toBe('Форт')
  expect(page.find('a[href="/forty"]').exists()).toBe(true)
  expect(sendEvents).not.toHaveBeenCalled()
  refresh.mockImplementation(async () => {
    status.value = 'pending'
    error.value = null
    await Promise.resolve()
    data.value = response()
    status.value = 'success'
  })
  await page.findAll('button').find((button) => button.text() === 'Повторить')!.trigger('click')
  await flushPromises()
  expect(refresh).toHaveBeenCalledExactlyOnceWith()
  expect(page.find('[role="alert"]').exists()).toBe(false)
  expect(page.get('.result').text()).toContain('Фикстура: форт')
  expect(sendEvents).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ type: 'search', q: 'Форт', count: 1 })])
  await page.get('.result').trigger('click')
  expect(sendEvents).toHaveBeenLastCalledWith([expect.objectContaining({ type: 'click', position: 1, path: '/fixture-fort' })])
})

it('logs a real successful empty search once and keeps alternative destinations', async () => {
  data.value = response('Форт', true)
  status.value = 'success'
  error.value = null
  const page = await renderPage()
  expect(page.text()).toContain('ничего не нашлось')
  expect(page.find('[role="alert"]').exists()).toBe(false)
  expect(page.find('a[href="/forty"]').exists()).toBe(true)
  expect(sendEvents).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ q: 'Форт', count: 0 })])
})

it('does not relabel or log retained results while a new query is pending or fails', async () => {
  data.value = response()
  status.value = 'success'
  error.value = null
  const page = await renderPage()
  expect(sendEvents).toHaveBeenCalledTimes(1)
  route.query.q = 'Замок'
  status.value = 'pending'
  await flushPromises()
  expect(page.get('[role="status"]').text()).toContain('Ищем')
  expect(page.find('.result').exists()).toBe(false)
  expect(page.text()).not.toContain('ничего не нашлось')
  expect(sendEvents).toHaveBeenCalledTimes(1)
  error.value = new Error('Service unavailable')
  status.value = 'error'
  await flushPromises()
  expect(page.find('[role="alert"]').exists()).toBe(true)
  expect(page.find('.result').exists()).toBe(false)
  expect(sendEvents).toHaveBeenCalledTimes(1)
  error.value = null
  data.value = response('Замок', true)
  status.value = 'success'
  await flushPromises()
  expect(page.text()).toContain('По запросу «Замок» ничего не нашлось')
  expect(sendEvents).toHaveBeenCalledTimes(2)
  expect(sendEvents).toHaveBeenLastCalledWith([expect.objectContaining({ q: 'Замок', count: 0 })])
})

it('rejects a late response for a different query even if its status is success', async () => {
  route.query.q = 'Замок'
  data.value = response('Форт')
  status.value = 'success'
  error.value = null
  const page = await renderPage()
  expect(page.find('.result').exists()).toBe(false)
  expect(page.text()).not.toContain('ничего не нашлось')
  expect(sendEvents).not.toHaveBeenCalled()
})

it('offers sections without a false failure or search event for an empty query', async () => {
  route.query.q = ''
  const page = await renderPage()
  expect(page.find('[role="alert"]').exists()).toBe(false)
  expect(page.find('[role="status"]').exists()).toBe(false)
  expect(page.find('a[href="/forty"]').exists()).toBe(true)
  expect(sendEvents).not.toHaveBeenCalled()
})

it('server-renders the same failure and a plain GET recovery form without analytics', async () => {
  const html = await renderToString(createSSRApp(SearchPage))
  expect(html).toContain('Не удалось выполнить поиск')
  expect(html).not.toContain('ничего не нашлось')
  expect(html).toContain('action="/poisk"')
  expect(html).toContain('method="get"')
  expect(html).toContain('href="/forty"')
  expect(sendEvents).not.toHaveBeenCalled()
})

it('server-renders real results and links without requiring client analytics', async () => {
  data.value = response()
  status.value = 'success'
  error.value = null
  const html = await renderToString(createSSRApp(SearchPage))
  expect(html).toContain('1 результат по запросу «Форт»')
  expect(html).toContain('href="/fixture-fort"')
  expect(html).not.toContain('Ищем')
  expect(sendEvents).not.toHaveBeenCalled()
})

it('keeps recovery available when both search and alternative-link requests fail', async () => {
  fetchPage.mockImplementation((url: string) => url === '/api/search'
    ? { data, status, error, refresh }
    : { data: ref(null) })
  const page = await renderPage()
  expect(page.get('[role="alert"]').text()).toContain('измените запрос')
  expect(page.find('form[action="/poisk"]').exists()).toBe(true)
  expect(page.findAll('button').some((button) => button.text() === 'Повторить')).toBe(true)
  expect(sendEvents).not.toHaveBeenCalled()
})
