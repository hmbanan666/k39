<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    :kicker="page.kind === 'month' ? 'Путеводитель по месяцу' : 'Подборка'"
  >
    <div
      class="prose"
      v-html="page.html"
    />
    <MapEmbed
      v-if="page.items[0]"
      :label="page.kind === 'month' ? 'Места на карте' : 'Карта подборки'"
      :focus-href="page.items[0].href"
      :hrefs="page.items.map((item) => item.href)"
    />
    <RouteSteps
      :title="page.kind === 'month' ? 'Места из путеводителя' : 'Места подборки'"
      :steps="page.items"
    />
    <LinkList
      title="Другие месяцы"
      :links="page.months"
    />
    <details
      v-if="page.sources.length"
      class="sources"
    >
      <summary>Источники</summary>
      <ul>
        <li
          v-for="source in page.sources"
          :key="source.url"
        >
          <UiLink
            :href="source.url"
            data-track="outbound"
            data-track-name="source"
          >
            {{ source.title }}
          </UiLink>
        </li>
      </ul>
    </details>
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

interface TextLink { href: string, text: string }

const slug = String(useRoute().params.slug || '')
const page = await fetchPublic<{
  doc: SeoDocument
  html: string
  items: TextLink[]
  kind: string
  sources: { title: string, url: string }[]
  months: TextLink[]
}>(`/api/public/collections/${slug}`)
usePublicHead(page.doc)
</script>

<style scoped>
.sources {
  margin-top: 2.8rem;
  border-top: 1px solid var(--color-line);
  color: var(--muted);
  font-size: 0.88rem;
}
.sources summary {
  width: fit-content;
  padding: 0.75rem 0;
  color: var(--color-ink);
  font-weight: 600;
  cursor: pointer;
}
.sources ul {
  margin: 0 0 0.4rem;
  padding: 0;
  list-style: none;
}
.sources li { padding: 0.15rem 0; }
.sources :deep(a) {
  color: var(--muted);
  font-weight: 500;
  text-underline-offset: 0.15em;
}
</style>
