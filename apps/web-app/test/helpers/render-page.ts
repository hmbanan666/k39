import type { Component } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'

/**
 * Server-render a page component from fixture props.
 * No database and no Nitro server. Nuxt auto-imports are provided by the Vitest plugin.
 */
export async function renderPage<P extends object>(component: Component, props: P) {
  const app = createSSRApp({
    render: () => h(component, props),
  })
  return renderToString(app)
}
