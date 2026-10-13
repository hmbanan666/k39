<template>
  <section class="module-places">
    <h2>{{ title }}</h2>
    <div class="card-grid cols-3">
      <div
        v-for="entry in ranked"
        :key="entry.item.href"
        class="slot"
        :class="[{ fits: fitsPicker(entry.fit) }]"
      >
        <PlaceCard
          :href="entry.item.href"
          :title="entry.item.title"
          :summary="entry.item.summary"
          :hub="entry.item.hub"
          :town="entry.item.town"
          :kind="entry.item.kind"
          :media="entry.item.media"
          :summary-lines="1"
          meta-place="stack"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { PickerState, PublicPlaceCard } from '~~/shared/page-modules'
import { fitsPicker, rankByPicker } from '~~/shared/page-modules'

const props = defineProps<{
  title: string
  places: Array<PublicPlaceCard & { media: PublicMedia | null }>
  state: PickerState
}>()

const ranked = computed(() => rankByPicker(props.places, (place) => place.tags, props.state))
</script>

<style scoped>
h2 {
  margin: 0 0 0.8rem;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 1.3rem + 0.8vw, 2rem);
  letter-spacing: -0.02em;
}
.slot { display: grid; }
.slot.fits :deep(> *) {
  outline: 2px solid var(--color-brick);
  outline-offset: 2px;
}
</style>
