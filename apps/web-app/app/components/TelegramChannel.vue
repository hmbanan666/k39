<template>
  <p
    v-if="variant === 'note'"
    class="channel-note"
  >
    Новые места и маршруты выходят в нашем канале.
    <a
      :href="TELEGRAM_CHANNEL_URL"
      target="_blank"
      rel="noopener"
      >Наш Telegram-канал</a
    >
  </p>
  <a
    v-else
    class="channel-link"
    :href="TELEGRAM_CHANNEL_URL"
    target="_blank"
    rel="noopener"
    >Наш Telegram-канал</a
  >
</template>

<script setup lang="ts">
import { TELEGRAM_CHANNEL_URL } from '~~/shared/seo'

withDefaults(
  defineProps<{
    /** `link` is the footer label. `note` is the one-line article closer. */
    variant?: 'note' | 'link'
  }>(),
  { variant: 'note' },
)
</script>

<style scoped>
.channel-note {
  max-width: 70ch;
  margin: var(--space-6) 0 var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
  color: var(--muted);
  font-size: var(--step--1);
  line-height: 1.5;
}
.channel-note a {
  font-weight: 700;
  white-space: nowrap;
}
.channel-link {
  display: inline-block;
  padding-block: 0.2rem;
}
</style>
