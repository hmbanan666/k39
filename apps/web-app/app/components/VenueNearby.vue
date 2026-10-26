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
        v-for="(item, index) in items"
        :key="item.href"
      >
        <VenueCard
          :href="item.href"
          :name="item.name"
          :kind-label="item.kindLabel"
          :media="item.media"
          :distance="item.distance"
          :walk="item.walk"
          :cuisine="item.cuisine"
          :price="item.price"
          :check="item.check"
          :partner="item.partner"
          :stale="item.stale"
          :schedule="item.schedule"
          :notices="item.notices"
          :phone="item.phone"
          :lean="index % 2 === 0 ? 'left' : 'right'"
          track
        />
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
import type { NoticeWindow } from '~~/shared/notices'
import type { ScheduleRecord } from '~~/shared/schedule'

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
  notices?: NoticeWindow[] | null
  phone?: string | null
}

const props = withDefaults(
  defineProps<{
    items: EatItem[]
    title?: string
    level?: 'h2' | 'h3'
    /** Mobile: «row» scrolls sideways (a few nearby cards), «grid» stacks a long list. */
    layout?: 'row' | 'grid'
    moreHref?: string
    moreText?: string
  }>(),
  { title: 'Где поесть рядом', level: 'h2', layout: 'row', moreHref: '', moreText: '' },
)

onMounted(() => {
  if (!props.items.length || typeof window === 'undefined') {
    return
  }
  for (const item of props.items) {
    window.dispatchEvent(
      new CustomEvent('k39-track', {
        detail: { type: 'impression', target: item.href },
      }),
    )
  }
})
</script>

<style scoped>
.eat {
  margin-top: 3rem;
}
.eat-bare {
  margin-top: 0;
}
.more {
  margin: 1rem 0 0;
  font-weight: 600;
}
h2,
h3 {
  margin-bottom: 1rem;
}
ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  min-width: 0;
}
@media (max-width: 640px) {
  .eat:not(.eat-grid) ul {
    grid-template-columns: none;
    grid-auto-columns: 72%;
    grid-auto-flow: column;
    overflow-x: auto;
    padding: 4px 2px 12px;
    scroll-snap-type: x mandatory;
  }
  .eat:not(.eat-grid) li {
    scroll-snap-align: start;
  }
}
</style>
