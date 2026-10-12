<template>
  <ArticleShell
    :h1="page.doc.h1"
    :crumbs="page.doc.crumbs"
    kicker="Квест"
  >
    <div
      class="prose"
      v-html="page.html"
    />
    <p
      v-if="page.route?.href"
      class="linked-route"
    >
      Маршрут
      <UiLink :href="page.route.href">
        {{ page.route.title }}
      </UiLink>
    </p>
    <section
      v-if="page.steps.length"
      class="stops"
    >
      <h2>Точки квеста</h2>
      <div class="card-grid">
        <PlaceCard
          v-for="step in page.steps"
          :key="step.href"
          :href="step.href"
          :title="step.title"
          :summary="step.task"
          :hub="step.label"
          :kind="step.kind"
          :media="step.media"
        />
      </div>
    </section>
  </ArticleShell>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { SeoDocument } from '~~/shared/seo'

const slug = String(useRoute().params.slug || '')
const page = await fetchPublic<{
  doc: SeoDocument
  html: string
  route: { slug: string, title: string, href: string | null } | null
  steps: Array<{ href: string, title: string, task: string, label: string, kind: string, media: PublicMedia | null }>
}>(`/api/public/quests/${slug}`)
usePublicHead(page.doc)
</script>

<style scoped>
.linked-route {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
}
.stops { margin-top: 2.2rem; }
.stops h2 { margin-bottom: 1rem; }
</style>
