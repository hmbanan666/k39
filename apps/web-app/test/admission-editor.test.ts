import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, Suspense } from 'vue'
import Editor from '../app/components/admin/PracticalEditor.vue'
import { admissionEditorFixture } from './fixtures/admission-extras'
import { renderPage } from './helpers/render-page'

const mounted: Array<ReturnType<typeof mount>> = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})
const button = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll('button').find((item) => item.text() === text)!
async function setup(options: { enabled?: boolean; fail?: boolean } = {}) {
  const fixture = admissionEditorFixture()
  fixture.extrasWriteEnabled = options.enabled ?? true
  const calls: Array<Record<string, unknown>> = []
  const fetch = vi.fn(async (_url: string, request?: { method?: string; body: Record<string, unknown> }) => {
    if (request?.method === 'PUT') {
      calls.push(request.body)
      if (options.fail) {
        throw Object.assign(new Error('fixture error'), {
          data: { statusMessage: 'Фикстура: источник временно недоступен' },
        })
      }
      return { writingWarnings: [] }
    }
    return structuredClone(fixture)
  })
  vi.stubGlobal('$fetch', fetch)
  const wrapper = mount(
    defineComponent({
      render: () => h(Suspense, null, { default: () => h(Editor, { subjectType: 'place', subjectId: 'fixture' }) }),
    }),
  )
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, calls, fetch }
}

describe('independent admission editor saves', () => {
  it('preserves unsaved extra input when only entry tickets are saved', async () => {
    const { wrapper, calls } = await setup()
    const extra = wrapper.findAll('fieldset').find((item) => item.find('legend').text().includes('аудиогид'))!
    const name = extra
      .findAll('label')
      .find((item) => item.text().startsWith('Название услуги'))!
      .find('input')
    await name.setValue('Фикстура: несохранённая экскурсия')
    await button(wrapper, 'Сохранить билеты').trigger('click')
    await flushPromises()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveProperty('rows')
    expect(calls[0]).not.toHaveProperty('extras')
    expect((name.element as HTMLInputElement).value).toBe('Фикстура: несохранённая экскурсия')
    expect(wrapper.find('[role="status"]').text()).toContain('Билеты сохранены')
  })

  it('sends a separate extra list and allows an explicit clear without sending tickets', async () => {
    const { wrapper, calls } = await setup()
    await button(wrapper, 'Сохранить допуслуги').trigger('click')
    await flushPromises()
    expect(calls[0]).toMatchObject({ extras: [{ slot: 'audio', priceRub: 200, unit: 'device' }] })
    expect(calls[0]).not.toHaveProperty('rows')
    await button(wrapper, 'Убрать допуслугу').trigger('click')
    await button(wrapper, 'Сохранить допуслуги').trigger('click')
    await flushPromises()
    expect(calls[1]).toEqual({ extras: [] })
  })

  it('retains user input and announces a failed extra save', async () => {
    const { wrapper, calls } = await setup({ fail: true })
    await button(wrapper, 'Добавить допуслугу').trigger('click')
    await button(wrapper, 'Сохранить допуслуги').trigger('click')
    await flushPromises()
    expect(calls).toHaveLength(1)
    expect(wrapper.findAll('fieldset')).toHaveLength(4)
    expect(wrapper.find('[role="status"]').text()).toBe('Фикстура: источник временно недоступен')
    expect(button(wrapper, 'Сохранить допуслуги').attributes('disabled')).toBeUndefined()
  })

  it('keeps entry editing available while extra writes are disabled for rollout', async () => {
    const { wrapper, calls } = await setup({ enabled: false })
    expect(button(wrapper, 'Сохранить допуслуги').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'Добавить допуслугу').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'Сохранить билеты').attributes('disabled')).toBeUndefined()
    await button(wrapper, 'Сохранить билеты').trigger('click')
    await flushPromises()
    expect(calls[0]).not.toHaveProperty('extras')
  })

  it('server-renders the two lists and source fields', async () => {
    const fixture = admissionEditorFixture()
    vi.stubGlobal(
      '$fetch',
      vi.fn(async () => fixture),
    )
    const html = await renderPage(Editor, { subjectType: 'route', subjectId: 'fixture' })
    expect(html).toContain('Фикстура: аудиогид')
    expect(html).toContain('За что указана цена')
    expect(html).toContain('Сохранить допуслуги')
    expect(html).not.toContain('<h3>События')
  })
})
