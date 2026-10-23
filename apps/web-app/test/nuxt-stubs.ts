import { defineComponent, h, ref } from 'vue'

/** Test stand-ins for Nuxt auto-imports. Not used by the running app. */

export function useHead() {}

export function useSeoMeta() {}

export function definePageMeta() {}

export function useRoute() {
  return { path: '/', query: {}, params: {}, fullPath: '/' }
}

export function useRouter() {
  return { push: async () => {}, replace: async () => {} }
}

export function navigateTo() {}

export function useNuxtApp() {
  return { _metaFootnote: undefined as { path: string } | undefined }
}

export function useRuntimeConfig() {
  return { public: {} }
}

export function useState<T>(key: string, init?: () => T) {
  return ref(init ? init() : undefined)
}

export function useUserSession() {
  return {
    loggedIn: ref(false),
    user: ref<{ role?: string } | null>(null),
    ready: ref(true),
  }
}

export function useFetch(url?: string) {
  const path = typeof url === 'string' ? url : ''
  if (path.includes('/api/admin/guests')) {
    return {
      data: ref({
        submissions: [{
          id: 'fixture-guest',
          createdAt: '2026-10-16T09:00:00.000Z',
          kind: 'review',
          body: 'Фикстура: отзыв гостя для проверки очереди модерации.',
          alt: '',
          correctionKind: null,
          correctionValue: '',
          sourceUrl: null,
          disputed: true,
          mediaId: null,
          byline: 'Анна К.',
          subjectTitle: 'Фикстура: кафе с фото',
          subjectPath: '/zavedeniya/fixture-cafe-photo',
        }],
        signals: [],
      }),
      pending: ref(false),
      refresh: async () => {},
    }
  }
  return {
    data: ref({
      consents: [{
        id: 'fixture-consent',
        email: 'guest@example.com',
        version: '2026-10-12',
        consentedAt: '2026-10-16T09:00:00.000Z',
        method: 'sign-in-button',
        withdrawnAt: null,
      }],
    }),
    pending: ref(false),
    refresh: async () => {},
  }
}

export const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: [String, Object], default: '' } },
  setup(props, { slots }) {
    return () => h('a', { href: typeof props.to === 'string' ? props.to : '' }, slots.default?.())
  },
})

export const ClientOnly = defineComponent({
  name: 'ClientOnly',
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  },
})

export const Icon = defineComponent({
  name: 'Icon',
  props: { name: { type: String, default: '' } },
  setup(props) {
    return () => h('span', { 'class': 'icon', 'data-icon': props.name })
  },
})

export const MapEmbed = defineComponent({
  name: 'MapEmbed',
  setup() {
    return () => h('div', { class: 'map-embed' })
  },
})

/** Component tests/captures install an isolated ofetch-compatible boundary. */
export function useRequestFetch() {
  return (globalThis as unknown as { $fetch: typeof import('ofetch').$fetch }).$fetch
}
