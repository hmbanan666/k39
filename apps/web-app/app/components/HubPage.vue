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
        <section class="facts">
          <h2>В разделе</h2>
          <div class="fact">
            <Icon :name="tablerIcon(slug)" size="22" />
            <div>
              <p class="label">
                Места
              </p>
              <p>
                <a :href="`#${PAGE_SECTIONS.places.id}`">{{ page.places.length }} с часами и ценами</a>
              </p>
            </div>
          </div>
          <div
            v-if="hrefs.length"
            class="fact"
          >
            <Icon :name="tablerIcon('address')" size="22" />
            <div>
              <p class="label">
                Карта
              </p>
              <p>
                <a :href="`#${PAGE_SECTIONS.map.id}`">Все места раздела на карте</a>
              </p>
            </div>
          </div>
          <div
            v-if="page.routes.length"
            class="fact"
          >
            <Icon :name="tablerIcon('routes')" size="22" />
            <div>
              <p class="label">
                Маршруты
              </p>
              <p>
                <a :href="`#${PAGE_SECTIONS.routes.id}`">{{ page.routes.length }} с этими местами</a>
              </p>
            </div>
          </div>
          <div
            v-if="slug === 'eda'"
            class="fact"
          >
            <Icon :name="tablerIcon('hours')" size="22" />
            <div>
              <p class="label">
                Сейчас
              </p>
              <p>
                <a :href="EAT_NOW_PATH">Где поесть сейчас: что открыто по городам</a>
              </p>
            </div>
          </div>
        </section>
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
import { tablerIcon } from '~~/shared/icons'
import { PAGE_SECTIONS, presentSections } from '~~/shared/page-sections'

const props = defineProps<{ slug: string }>()
const page = await fetchPublic<{
  doc: SeoDocument
  html: string
  bodyHtml: string
  places: Array<{ href: string, title: string, summary: string, hub: string, hubHref: string, kind: string, media: PublicMedia | null, image: { src: string, alt: string, width: number | null, height: number | null } | null }>
  routes: { href: string, text: string }[]
}>(`/api/public/hubs/${props.slug}`)
const articleHtml = `${page.html}${page.bodyHtml}`
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
.facts {
  position: relative;
  overflow: hidden;
  padding: 1.2rem 1.15rem 0.4rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.facts::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 6px;
  background: repeating-linear-gradient(90deg, var(--color-brick) 0 18px, transparent 18px 26px, var(--color-sea) 26px 44px, transparent 44px 52px);
}
.facts h2 { margin: 0.35rem 0 0.3rem; font-size: 1.35rem; }
.fact {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 0.7rem;
  padding: 0.8rem 0;
  border-top: 1px dashed var(--color-line);
}
.fact:first-of-type { border-top: 0; }
.fact svg { margin-top: 0.15rem; color: var(--color-brick); }
.fact p { margin: 0; font-size: 0.97rem; line-height: 1.45; }
.fact .label {
  margin-bottom: 0.3rem;
  color: var(--muted);
  font: 600 0.72rem/1 var(--font-body);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.fact a { font-weight: 600; }
</style>
