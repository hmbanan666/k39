<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
  >
    <p>{{ page.place.summary }}</p>
    <ul class="facts">
      <li>Статус: {{ statusLabel }}</li>
      <li>Часы: {{ page.place.hours || 'уточнить' }}</li>
      <li v-if="page.place.price">
        Цена: {{ page.place.price }}
      </li>
      <li v-if="page.region">
        Регион: {{ page.region.title }}
      </li>
      <li v-if="page.place.latitude != null && page.place.longitude != null">
        Координаты: {{ page.place.latitude.toFixed(5) }}, {{ page.place.longitude.toFixed(5) }}
      </li>
    </ul>
    <figure
      v-for="(image, index) in page.images"
      :key="image.src"
    >
      <img
        :src="image.src"
        :alt="image.alt"
        :width="image.width || undefined"
        :height="image.height || undefined"
        :loading="index === 0 ? 'eager' : 'lazy'"
        :fetchpriority="index === 0 ? 'high' : 'auto'"
      >
    </figure>
    <div v-html="page.html" />
    <h2 v-if="page.sources.length">
      Источники
    </h2>
    <ul v-if="page.sources.length">
      <li
        v-for="source in page.sources"
        :key="source.url"
      >
        <a
          :href="source.url"
          rel="noopener"
        >{{ source.title }}</a>
      </li>
    </ul>
    <p v-if="page.place.latitude != null && page.place.longitude != null">
      <a
        :href="yandex"
        rel="noopener"
      >Маршрут в Яндекс Картах</a>
    </p>
    <LinkList
      v-for="group in page.groups"
      :key="group.title"
      :title="group.title"
      :links="group.links"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

interface PlacePage {
  doc: SeoDocument
  html: string
  place: { summary: string, status: string, hours: string | null, price: string | null, latitude: number | null, longitude: number | null }
  region: { title: string } | null
  images: Array<{ src: string, alt: string, width: number | null, height: number | null }>
  groups: Array<{ title: string, links: Array<{ href: string, text: string }> }>
  sources: Array<{ title: string, url: string }>
}

const route = useRoute()
const slug = String(route.params.slug || '')
const pageQuery = Number(route.query.page ?? 1)
const page = await fetchPublic<PlacePage>(`/api/public/places/${slug}`, { page: Number.isFinite(pageQuery) ? pageQuery : 1 })
const statusLabel = ({ open: 'открыт', ruins: 'руины', closed: 'закрыт', unknown: 'статус неизвестен' } as Record<string, string>)[page.place.status] || page.place.status
const yandex = page.place.latitude != null
  ? `https://yandex.ru/maps/?rtext=~${page.place.latitude}%2C${page.place.longitude}&rtt=mt`
  : ''
usePublicHead(page.doc)
onMounted(() => useTrack().track('page_view', { placeSlug: slug }))
</script>

<style scoped>
.facts { padding-left: 1.1rem; }
img { max-width: 100%; height: auto; }
</style>
