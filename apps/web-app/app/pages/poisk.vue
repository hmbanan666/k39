<template>
  <ArticleShell
    h1="Поиск по сайту"
    :crumbs="crumbs"
  >
    <SearchForm
      class="page-form"
      surface="page"
      size="large"
      :query="query"
    />
    <template v-if="query">
      <p class="count">
        {{ results.length ? `${resultsLabel(results.length)} по запросу «${query}»` : `По запросу «${query}» ничего не нашлось` }}
      </p>
      <ol
        v-if="results.length"
        class="results"
      >
        <li
          v-for="(item, index) in results"
          :key="item.path"
        >
          <a
            :href="item.path"
            class="result"
            @click="clicked(index, item.path)"
          >
            <span class="meta">
              {{ [item.label, item.region].filter(Boolean).join(' · ') }}
            </span>
            <span class="title">{{ item.title }}</span>
            <span
              v-if="item.snippet"
              class="snippet"
            >{{ item.snippet }}</span>
          </a>
        </li>
      </ol>
      <div
        v-else
        class="empty"
      >
        <Sticker
          class="mascot"
          slug="shrugging"
          :width="140"
        />
        <p>
          Мы записали этот запрос и подумаем, какой страницы не хватает. Попробуйте другое слово или загляните в разделы.
        </p>
      </div>
    </template>
    <div
      v-if="!results.length && links"
      class="lists"
    >
      <LinkList
        title="Разделы"
        :links="links.hubs"
      />
      <LinkList
        title="Популярные места"
        :links="links.places"
      />
      <LinkList
        title="Маршруты"
        :links="links.routes"
      />
    </div>
  </ArticleShell>
</template>

<script setup lang="ts">
import type { TextLink } from '~~/shared/links'
import type { SearchResponse } from '~~/shared/search'
import { newSearchId, resultsLabel, searchQueryParam, searchSurface, sendSearchEvents } from '~~/shared/search'
import { SITE_ORIGIN } from '~~/shared/seo'

const route = useRoute()
const query = computed(() => searchQueryParam(route.query.q))
const crumbs = [
  { name: 'Главная', href: '/' },
  { name: 'Поиск', href: '/poisk' },
]

const { data } = await useFetch<SearchResponse>('/api/search', { query: { q: query } })
const results = computed(() => data.value?.results ?? [])

const { data: links } = await useFetch<{ hubs: TextLink[], places: TextLink[], routes: TextLink[] }>('/api/public/error-links')

// Same HTML for people and bots; the page is never indexed (ADR 0030).
useSeoMeta({
  title: () => (query.value ? `Поиск: ${query.value} | K39` : 'Поиск по сайту | K39'),
  description: 'Поиск по местам, маршрутам, подборкам и заведениям Калининградской области.',
  robots: 'noindex, follow',
})
useHead({ link: [{ rel: 'canonical', href: `${SITE_ORIGIN}/poisk` }] })

let searchId = ''

function logSearch() {
  if (!query.value) {
    return
  }
  searchId = newSearchId()
  sendSearchEvents([{ type: 'search', id: searchId, q: query.value, count: results.value.length, surface: searchSurface(route.query.s) }])
}

function clicked(index: number, path: string) {
  if (searchId) {
    sendSearchEvents([{ type: 'click', id: searchId, position: index + 1, path }])
  }
}

onMounted(logSearch)
watch(() => data.value, logSearch)
</script>

<style scoped>
.page-form {
  max-width: 40rem;
  margin-bottom: var(--space-5);
}
.count {
  color: var(--muted);
}
.results {
  display: grid;
  gap: var(--space-3);
  max-width: 48rem;
  margin: 0 0 var(--space-6);
  padding: 0;
  list-style: none;
}
.result {
  display: grid;
  gap: 0.3rem;
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--text);
  text-decoration: none;
}
.result:hover {
  border-color: var(--color-brick);
}
.meta {
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.title {
  font: 700 1.25rem/1.2 var(--font-display);
}
.snippet {
  color: var(--muted);
  line-height: 1.45;
}
.empty {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  max-width: 40rem;
  margin-bottom: var(--space-6);
}
.empty p { margin: 0; }
.mascot {
  flex: none;
  width: 110px;
}
.lists {
  display: grid;
  gap: var(--space-5);
}
@media (min-width: 760px) {
  .lists { grid-template-columns: 1fr 1fr; }
}
</style>
