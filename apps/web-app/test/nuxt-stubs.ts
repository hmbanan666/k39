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

export function useFetch() {
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
