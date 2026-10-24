<template>
  <article class="page page-wide hub">
    <PageHeader
      :h1="page.doc.h1"
      :crumbs="page.doc.crumbs"
      kicker="Раздел"
    />
    <ReaderLayout
      :html="articleHtml"
      :sections-after="sections"
    >
      <template #lead>
        <FactsCard title="В разделе">
          <GuideFactRow :row="{ key: slug, label: 'Места' }">
            <p>
              <a :href="`#${PAGE_SECTIONS.places.id}`">{{ page.places.length }} с часами и ценами</a>
            </p>
          </GuideFactRow>
          <GuideFactRow
            v-if="hrefs.length"
            :row="{ key: 'address', label: 'Карта' }"
          >
            <p>
              <a :href="`#${PAGE_SECTIONS.map.id}`">Все места раздела на карте</a>
            </p>
          </GuideFactRow>
          <GuideFactRow
            v-if="page.routes.length"
            :row="{ key: 'routes', label: 'Маршруты' }"
          >
            <p>
              <a :href="`#${PAGE_SECTIONS.routes.id}`">{{ page.routes.length }} с этими местами</a>
            </p>
          </GuideFactRow>
          <GuideFactRow
            v-if="slug === 'eda'"
            :row="{ key: 'hours', label: 'Сейчас' }"
          >
            <p>
              <a :href="EAT_NOW_PATH">Где поесть сейчас: что открыто по территориям</a>
            </p>
            <p v-if="eatTowns.length">
              Заведения:
              <template
                v-for="(town, index) in eatTowns"
                :key="town.slug"
              >
                <NuxtLink :to="`/zavedeniya/${town.slug}`">
                  {{ town.title }}
                </NuxtLink>{{ index < eatTowns.length - 1 ? ', ' : '' }}
              </template>
            </p>
          </GuideFactRow>
          <GuideFactRow
            v-if="slug === 'eda'"
            :row="{ key: 'menu', label: 'Меню' }"
          >
            <p>
              <a :href="CHEAPER_PATH">Где дешевле: цены из меню по территориям</a>
            </p>
          </GuideFactRow>
        </FactsCard>
      </template>
    </ReaderLayout>
    <section
      v-if="hrefs.length"
      :id="PAGE_SECTIONS.map.id"
      class="block"
    >
      <h2>{{ PAGE_SECTIONS.map.title }}</h2>
      <MapEmbed
        :label="`Карта: ${page.doc.h1}`"
        :focus-href="hrefs[0] || `/${slug}`"
        :hrefs="hrefs"
      />
    </section>
    <section
      :id="PAGE_SECTIONS.places.id"
      class="block"
    >
      <h2>{{ PAGE_SECTIONS.places.title }}</h2>
      <div class="card-grid">
        <PlaceCard
          v-for="place in page.places"
          :key="place.href"
          :href="place.href"
          :title="place.title"
          :summary="place.summary"
          :kind="place.kind"
          :media="place.media"
          :image="place.image"
        />
      </div>
    </section>
    <div
      v-if="page.routes.length"
      :id="PAGE_SECTIONS.routes.id"
      class="block"
    >
      <LinkList
        :title="PAGE_SECTIONS.routes.title"
        :links="page.routes"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { SeoDocument } from '~~/shared/seo'
import { EAT_NOW_PATH } from '~~/shared/eat-now'
import { PAGE_SECTIONS, presentSections } from '~~/shared/page-sections'
import { CHEAPER_PATH } from '~~/shared/price-compare'

const props = defineProps<{ slug: string }>()
const page = await fetchPublic<{
  doc: SeoDocument
  html: string
  bodyHtml: string
  places: Array<{ href: string, title: string, summary: string, hub: string, hubHref: string, kind: string, media: PublicMedia | null, image: { src: string, alt: string, width: number | null, height: number | null } | null }>
  routes: { href: string, text: string }[]
}>(`/api/public/hubs/${props.slug}`)
const articleHtml = `${page.html}${page.bodyHtml}`
const eatTowns = props.slug === 'eda'
  ? (await fetchPublic<{ towns: Array<{ slug: string, title: string }> }>('/api/public/eat-now')).towns
  : []
const hrefs = page.places.map((place) => place.href)
const sections = presentSections([
  [PAGE_SECTIONS.map, hrefs.length > 0],
  [PAGE_SECTIONS.places, true],
  [PAGE_SECTIONS.routes, page.routes.length > 0],
])
usePublicHead(page.doc)
</script>

<style scoped>
.block { margin-top: var(--space-7); }
.block h2 { margin: 0 0 var(--space-4); }
</style>
