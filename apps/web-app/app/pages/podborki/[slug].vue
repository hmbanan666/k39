<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    :kicker="page.kind === 'month' ? 'Путеводитель по месяцу' : 'Подборка'"
  >
    <div
      v-if="page.cover"
      class="cover"
    >
      <PlacePhoto
        :media="page.cover"
        priority
        sizes="(min-width: 900px) 720px, 100vw"
        @open="openPhoto(page.cover.id)"
      />
      <p
        v-if="page.cover.caption"
        class="caption"
      >
        {{ page.cover.caption }}
      </p>
    </div>
    <ReaderLayout
      v-if="page.modules.length"
      :sections-before="moduleSections"
      :sections-after="sectionsAfter"
    >
      <template #body>
        <PageModuleList
          :modules="page.modules"
          :places="page.places"
          :months="page.monthNav"
        />
      </template>
    </ReaderLayout>
    <ReaderLayout
      v-else
      :html="page.html"
      :sections-after="sectionsAfter"
    />
    <section
      v-if="rest.length"
      :id="PAGE_SECTIONS.gallery.id"
      class="gallery"
      aria-label="Фотографии"
    >
      <figure
        v-for="photo in rest"
        :key="photo.id"
      >
        <PlacePhoto
          :media="photo"
          sizes="(min-width: 900px) 360px, 100vw"
          @open="openPhoto(photo.id)"
        />
        <figcaption>
          <span v-if="photo.caption">{{ photo.caption }}</span>
          <MediaCredit :media="photo" />
        </figcaption>
      </figure>
    </section>
    <MapEmbed
      v-if="!page.modules.length && page.places[0]"
      :label="page.kind === 'month' ? 'Места на карте' : 'Карта подборки'"
      :focus-href="page.places[0].href"
      :hrefs="page.places.map((place) => place.href)"
    />
    <section
      v-if="!page.modules.length && page.places.length"
      :id="PAGE_SECTIONS.places.id"
      class="places"
    >
      <h2>{{ placesTitle }}</h2>
      <div class="card-grid cols-3">
        <PlaceCard
          v-for="place in page.places"
          :key="place.href"
          :href="place.href"
          :title="place.title"
          :summary="place.summary"
          :hub="place.hub"
          :town="place.town"
          :kind="place.kind"
          :media="place.media"
          :summary-lines="1"
          meta-place="stack"
        />
      </div>
    </section>
    <LinkList
      v-if="!page.modules.length"
      title="Другие месяцы"
      :links="page.months"
    />
    <PhotoViewer
      v-if="photos.length"
      v-model:open="viewerOpen"
      v-model:index="viewerIndex"
      :photos="photos"
    />
    <details
      v-if="page.sources.length"
      :id="PAGE_SECTIONS.sources.id"
      class="sources"
    >
      <summary>{{ PAGE_SECTIONS.sources.title }}</summary>
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
import type { PublicMedia } from '~~/shared/media'
import type { PublicPageModule, PublicPlaceCard } from '~~/shared/page-modules'
import type { PageSection } from '~~/shared/page-sections'
import type { SeoDocument } from '~~/shared/seo'
import { moduleAnchors, PAGE_SECTIONS, presentSections } from '~~/shared/page-sections'

interface TextLink { href: string, text: string }

const slug = String(useRoute().params.slug || '')
const page = await fetchPublic<{
  doc: SeoDocument
  html: string
  modules: PublicPageModule[]
  places: Array<PublicPlaceCard & { media: PublicMedia | null }>
  kind: string
  sources: { title: string, url: string }[]
  months: TextLink[]
  monthNav: Array<TextLink & { current: boolean }>
  cover: PublicMedia | null
  gallery: PublicMedia[]
}>(`/api/public/collections/${slug}`)
const photos = page.gallery
const rest = page.cover ? photos.filter((item) => item.id !== page.cover?.id) : photos
const viewerOpen = ref(false)
const viewerIndex = ref(0)
function openPhoto(id: string) {
  const found = photos.findIndex((item) => item.id === id)
  viewerIndex.value = found >= 0 ? found : 0
  viewerOpen.value = true
}
usePublicHead(page.doc)
const placesTitle = page.kind === 'month' ? 'Места из путеводителя' : 'Места подборки'
const moduleSections = moduleAnchors(page.modules, (module) => module.type !== 'places' || page.places.length > 0)
  .filter((item): item is PageSection => Boolean(item))
const sectionsAfter = presentSections([
  [PAGE_SECTIONS.gallery, rest.length > 0],
  [PAGE_SECTIONS.places, !page.modules.length && page.places.length > 0],
], { [PAGE_SECTIONS.places.id]: placesTitle })
</script>

<style scoped>
.cover { margin: 0 0 1.6rem; }
.caption,
.gallery figcaption {
  margin: 0.45rem 0 0;
  color: var(--muted);
  font-size: 0.88rem;
}
.gallery {
  display: grid;
  gap: 1.2rem;
  margin: 2rem 0;
}
.gallery figure { margin: 0; }
.gallery figcaption {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.6rem;
}
.places h2 { margin-bottom: 1rem; }
@media (min-width: 700px) {
  .gallery { grid-template-columns: repeat(2, 1fr); }
}
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
