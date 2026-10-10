<template>
  <article class="place-page">
    <p class="kicker">
      {{ typeTitle }}
    </p>
    <h1>{{ place.title }}</h1>
    <p
      v-if="place.germanName"
      class="muted"
    >
      {{ place.germanName }}
    </p>
    <p
      v-if="place.nameNote"
      class="note"
    >
      {{ place.nameNote }}
    </p>
    <ul class="facts">
      <li>
        <span>Статус</span>
        <strong>{{ place.statusLabel }}</strong>
        ({{ STATUS_TITLE[place.status] }})
      </li>
      <li>
        <span>Часы работы</span>
        {{ place.hours || 'уточнить' }}
      </li>
      <li v-if="place.hoursNote">
        <span>Примечание</span>
        {{ place.hoursNote }}
      </li>
      <li>
        <span>Координаты</span>
        {{ place.lat.toFixed(5) }}, {{ place.lon.toFixed(5) }}
      </li>
    </ul>
    <div class="body">
      <slot />
    </div>
    <p>
      Источник:
      <a
        :href="place.sourceUrl"
        rel="noopener"
        target="_blank"
      >{{ place.sourceName }}</a>
    </p>
    <p class="actions">
      <a
        :href="routeUrl"
        rel="noopener"
        target="_blank"
      >Маршрут в Яндекс Картах</a>
      <a
        v-if="place.mapId"
        :href="`/map/${place.region}#${place.mapId}`"
      >На иллюстрированной карте</a>
    </p>
  </article>
</template>

<script setup lang="ts">
import type { PlacePageModel } from '~/utils/place-page'
import { computed } from 'vue'
import { PLACE_TYPE_TITLE, STATUS_TITLE, yandexRouteUrl } from '~/utils/place-page'

const props = defineProps<{ place: PlacePageModel }>()
const typeTitle = computed(() => PLACE_TYPE_TITLE[props.place.placeType] ?? props.place.placeType)
const routeUrl = computed(() => yandexRouteUrl(props.place.lat, props.place.lon))
</script>

<style scoped>
.place-page { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
.kicker { letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.8rem; }
h1 { font-family: "K39 Display", Georgia, serif; font-size: 2.4rem; line-height: 1.15; margin: 0.2rem 0 0.6rem; }
.muted { font-style: italic; }
.note { border-left: 3px solid #9b3d2a; padding-left: 0.7rem; }
.facts { list-style: none; padding: 0; }
.facts li { margin: 0.35rem 0; }
.facts span { display: inline-block; min-width: 8rem; }
.actions { display: flex; flex-wrap: wrap; gap: 1rem; }
.actions a { font-weight: 700; }
</style>
