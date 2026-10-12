<template>
  <ArticleShell
    :h1="h1"
    :crumbs="crumbs"
    :lede="lede"
  >
    <div class="legal">
      <p class="revised">
        Редакция от 12 октября 2026.
      </p>
      <slot />
    </div>
  </ArticleShell>
</template>

<script setup lang="ts">
import type { Crumb } from '~~/shared/seo'
import { breadcrumbNode, DEFAULT_OG_IMAGE, metaDescription, pageTitle } from '~~/shared/seo'

const props = defineProps<{
  h1: string
  path: string
  lede: string
  description: string
}>()

const crumbs: Crumb[] = [
  { name: 'Главная', href: '/' },
  { name: props.h1, href: props.path },
]
usePublicHead({
  title: pageTitle(props.h1, 'K39'),
  description: metaDescription(props.description),
  canonical: `https://k39.online${props.path}`,
  robots: 'index, follow',
  h1: props.h1,
  crumbs,
  ogImage: DEFAULT_OG_IMAGE,
  jsonLd: [breadcrumbNode(crumbs)],
})
</script>

<style scoped>
.revised { color: var(--muted); font-size: 0.9rem; }
.legal :deep(h2) {
  margin: 1.8rem 0 0.6rem;
  font-family: var(--font-display);
  font-size: 1.45rem;
}
.legal :deep(p),
.legal :deep(li) { line-height: 1.6; }
.legal :deep(ul) { padding-left: 1.2rem; }
.legal :deep(a) { font-weight: 700; }
</style>
