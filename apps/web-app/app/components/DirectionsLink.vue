<template>
  <a
    v-if="href"
    class="btn"
    :class="{ 'btn-line': variant === 'line' }"
    :href="href"
    target="_blank"
    rel="noopener nofollow"
    data-track="directions"
    data-track-name="directions"
    :data-track-entity="entity"
  >Как добраться</a>
</template>

<script setup lang="ts">
import { yandexDestinationUrl } from '~~/shared/embed-map'

const props = withDefaults(defineProps<{
  latitude: number
  longitude: number
  entity: string
  variant?: 'primary' | 'line'
}>(), {
  variant: 'primary',
})

const href = computed(() => yandexDestinationUrl(props.latitude, props.longitude))
</script>
