<template>
  <a
    class="card"
    :class="leanClass"
    :href="href"
    v-bind="trackAttrs"
  >
    <span class="pic">
      <MediaImage
        v-if="media"
        :media="media"
        :show-credit="false"
        :sizes="sizes"
        :priority="priority"
      />
      <img
        v-else
        class="art"
        :src="illustrationFor('food')"
        alt=""
        width="400"
        height="260"
        loading="lazy"
      >
      <span class="kind">{{ kindLabel }}</span>
      <span
        v-if="distanceLabel"
        class="dist"
      >{{ distanceLabel }}</span>
      <slot name="overlay" />
    </span>
    <span class="body">
      <span
        v-if="partner"
        class="partner"
      >Партнёр</span>
      <slot name="kicker" />
      <span class="name">{{ name }}</span>
      <span
        v-if="line"
        class="meta"
      >{{ line }}</span>
      <span
        v-if="phoneLabel"
        class="phone"
      >{{ phoneLabel }}</span>
      <slot name="meta" />
      <OpeningLive
        :schedule="schedule ?? null"
        show-unknown
        compact
        hide-remaining
      />
      <span
        v-if="stale"
        class="stale"
      >Давно не проверяли</span>
      <slot />
    </span>
  </a>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { ScheduleRecord } from '~~/shared/schedule'
import { computed } from 'vue'
import { illustrationFor } from '~~/shared/illustrations'
import { formatPhoneDisplay, parsePhones } from '~~/shared/phone'

const props = withDefaults(defineProps<{
  href: string
  name: string
  kindLabel: string
  media?: PublicMedia | null
  distance?: string
  walk?: string
  cuisine?: string[]
  price?: string
  check?: string
  /** Replaces the cuisine, price and check line when set. */
  meta?: string
  partner?: boolean
  stale?: boolean
  schedule?: ScheduleRecord | null
  /** Resting tilt. «none» keeps a single card still. */
  lean?: 'left' | 'right' | 'none'
  sizes?: string
  priority?: boolean
  /** Cookieless click beacon used by the nearby block. */
  track?: boolean
  /** Stored phone. The card prints the display grouping. The card itself is the link. */
  phone?: string | null
}>(), {
  media: null,
  distance: '',
  walk: '',
  cuisine: () => [],
  price: '',
  check: '',
  meta: '',
  partner: false,
  stale: false,
  schedule: null,
  lean: 'none',
  sizes: '(min-width: 900px) 240px, 70vw',
  priority: false,
  track: false,
  phone: '',
})

const leanClass = computed(() => props.lean === 'none' ? undefined : `lean-${props.lean}`)

const phoneLabel = computed(() => {
  if (!parsePhones(props.phone).some((item) => item.e164)) {
    return ''
  }
  return formatPhoneDisplay(props.phone)
})

const line = computed(() => {
  const custom = props.meta.trim()
  if (custom) {
    return custom
  }
  return [props.cuisine.join(', '), props.price, props.check].filter(Boolean).join(' · ')
})

const distanceLabel = computed(() => {
  if (!props.distance) {
    return ''
  }
  if (!props.walk) {
    return props.distance
  }
  return `${props.distance} · ${props.walk.replace(' пешком', '')}`
})

const trackAttrs = computed(() => props.track
  ? { 'data-track': 'outbound', 'data-track-name': 'venue' }
  : {})
</script>

<style scoped>
.card {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 8px 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  color: inherit;
  text-decoration: none;
  transition: box-shadow var(--duration) var(--ease), transform var(--duration) var(--ease);
}
.card.lean-left { transform: rotate(-0.5deg); }
.card.lean-right { transform: rotate(0.4deg); }
.card:hover { box-shadow: var(--shadow-pop); transform: rotate(0deg) translateY(-2px); }
.pic {
  position: relative;
  display: block;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  border-radius: 4px;
  background: var(--color-amber-soft);
}
.pic :deep(figure),
.pic :deep(picture) {
  display: block;
  width: 100%;
  height: 100%;
  margin: 0;
}
/* Fill the 4:3 box: MediaImage's own 3:2 ratio left a beige strip below the photo. */
.pic img,
.pic :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  object-fit: cover;
}
/* The plate illustration stays whole. A photo still fills the box. */
.pic img.art {
  object-fit: contain;
  padding: 12%;
  background: transparent;
}
.kind,
.dist {
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
.dist {
  right: 6px;
  border-radius: 99px;
  font-weight: 700;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.6rem 0.3rem 0;
}
.name {
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 700;
  line-height: 1.15;
}
.meta {
  color: var(--muted);
  font-size: var(--step--1);
}
.phone {
  color: var(--color-ink);
  font-size: var(--step--1);
  font-variant-numeric: tabular-nums;
}
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
.stale {
  color: var(--color-warn);
  font-size: var(--step--1);
}
@media (prefers-reduced-motion: reduce) {
  .card,
  .card:hover { transform: none; }
}
</style>
