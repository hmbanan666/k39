<template>
  <section
    v-if="items.length"
    class="eat"
    :class="{ 'eat-grid': layout === 'grid', 'eat-bare': !title }"
  >
    <component
      :is="level"
      v-if="title"
    >
      {{ title }}
    </component>
    <ul>
      <li
        v-for="item in items"
        :key="item.href"
      >
        <a
          class="card"
          :href="item.href"
          data-track="outbound"
          data-track-name="venue"
        >
          <span class="pic">
            <MediaImage
              v-if="item.media"
              :media="item.media"
              :show-credit="false"
              sizes="(min-width: 900px) 240px, 70vw"
            />
            <img
              v-else
              :src="illustrationFor('food')"
              alt=""
              width="400"
              height="260"
              loading="lazy"
            >
            <span class="kind">{{ item.kindLabel }}</span>
            <span class="dist">{{ item.walk ? `${item.distance} · ${item.walk.replace(' пешком', '')}` : item.distance }}</span>
          </span>
          <span class="body">
            <span
              v-if="item.partner"
              class="partner"
            >Партнёр</span>
            <span class="name">{{ item.name }}</span>
            <span
              v-if="meta(item)"
              class="meta"
            >{{ meta(item) }}</span>
            <!-- Client-only: only verified hours report open or closed (ADR 0028). -->
            <OpeningLive
              :schedule="item.schedule ?? null"
              show-unknown
              compact
            />
            <span
              v-if="item.stale"
              class="stale"
            >Давно не проверяли</span>
          </span>
        </a>
      </li>
    </ul>
    <p
      v-if="moreHref"
      class="more"
    >
      <a :href="moreHref">{{ moreText }}</a>
    </p>
  </section>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { ScheduleRecord } from '~~/shared/schedule'
import { illustrationFor } from '~~/shared/illustrations'

interface EatItem {
  href: string
  slug: string
  name: string
  kindLabel: string
  distance: string
  walk?: string
  cuisine?: string[]
  price?: string
  check?: string
  partner: boolean
  stale: boolean
  media?: PublicMedia | null
  schedule?: ScheduleRecord | null
}

const props = withDefaults(defineProps<{
  items: EatItem[]
  title?: string
  level?: 'h2' | 'h3'
  /** Mobile: «row» scrolls sideways (a few nearby cards), «grid» stacks a long list. */
  layout?: 'row' | 'grid'
  moreHref?: string
  moreText?: string
}>(), { title: 'Где поесть рядом', level: 'h2', layout: 'row', moreHref: '', moreText: '' })

function meta(item: EatItem) {
  return [(item.cuisine ?? []).join(', '), item.price, item.check].filter(Boolean).join(' · ')
}

onMounted(() => {
  if (!props.items.length || typeof window === 'undefined') {
    return
  }
  for (const item of props.items) {
    window.dispatchEvent(new CustomEvent('k39-track', {
      detail: { type: 'impression', target: item.href },
    }))
  }
})
</script>

<style scoped>
.eat { margin-top: 3rem; }
.eat-bare { margin-top: 0; }
.more { margin: 1rem 0 0; font-weight: 600; }
h2, h3 { margin-bottom: 1rem; }
ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  color: inherit;
  text-decoration: none;
  transition: box-shadow var(--duration) var(--ease), transform var(--duration) var(--ease);
}
li:nth-child(odd) .card { transform: rotate(-0.5deg); }
li:nth-child(even) .card { transform: rotate(0.4deg); }
.card:hover { box-shadow: var(--shadow-pop); transform: rotate(0deg) translateY(-2px); }
.pic {
  position: relative;
  display: block;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  border-radius: 4px;
  background: var(--color-amber-soft);
}
.pic :deep(figure) { margin: 0; height: 100%; }
.pic img, .pic :deep(img) { display: block; width: 100%; height: 100%; object-fit: cover; }
.kind, .dist {
  position: absolute;
  top: 6px;
  padding: 2px 8px;
  background: var(--surface);
  font-size: var(--step--1);
  line-height: 1.4;
}
.kind {
  left: 6px;
  border-radius: 4px;
  color: var(--accent);
  font-family: var(--font-stamp);
  font-weight: 700;
}
.dist { right: 6px; border-radius: 99px; font-weight: 700; }
.body { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.6rem 0.3rem 0; }
.name { font-family: var(--font-display); font-size: var(--step-1); font-weight: 700; line-height: 1.15; }
.meta { color: var(--muted); font-size: var(--step--1); }
.body :deep(.live) { margin: 0.2rem 0 0; }
.partner {
  align-self: flex-start;
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  background: var(--color-amber-soft);
  color: var(--color-partner);
  font-family: var(--font-stamp);
  font-size: var(--step--1);
}
.stale { color: var(--color-warn); font-size: var(--step--1); }
@media (max-width: 640px) {
  .eat:not(.eat-grid) ul {
    grid-template-columns: none;
    grid-auto-columns: 72%;
    grid-auto-flow: column;
    overflow-x: auto;
    padding: 4px 2px 12px;
    scroll-snap-type: x mandatory;
  }
  .eat:not(.eat-grid) li { scroll-snap-align: start; }
}
@media (prefers-reduced-motion: reduce) {
  .card, .card:hover { transform: none; }
}
</style>
