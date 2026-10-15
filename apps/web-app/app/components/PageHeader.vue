<template>
  <!-- Section and listing pages open like object pages: breadcrumbs above,
       then a kicker, the title and an optional lede. No card, no postmark. -->
  <UiBreadcrumbs :crumbs="crumbs" />
  <header class="page-header">
    <div
      v-if="$slots.mark"
      class="with-mark"
    >
      <slot name="mark" />
      <div>
        <p
          v-if="kicker"
          class="kicker"
        >
          {{ kicker }}
        </p>
        <h1>{{ h1 }}</h1>
      </div>
    </div>
    <template v-else>
      <p
        v-if="kicker"
        class="kicker"
      >
        {{ kicker }}
      </p>
      <h1>{{ h1 }}</h1>
    </template>
    <p
      v-if="lede"
      class="lede"
    >
      {{ lede }}
    </p>
    <div
      v-if="$slots.default"
      class="extra"
    >
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
import type { Crumb } from '~~/shared/seo'

withDefaults(defineProps<{
  h1: string
  crumbs?: Crumb[]
  kicker?: string
  lede?: string
}>(), {
  crumbs: () => [],
  kicker: '',
  lede: '',
})
</script>

<style scoped>
.page-header {
  margin: 0.4rem 0 var(--space-6);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--color-line);
}
.kicker {
  margin: 0 0 0.45rem;
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  margin: 0.35rem 0 0;
  font-size: clamp(2.35rem, 1.15rem + 2.5vw, 3.5rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.lede {
  max-width: 60ch;
  margin: 0.8rem 0 0;
  color: var(--text);
  font-size: 1.12rem;
  line-height: 1.55;
}
.extra { margin-top: var(--space-4); }
.with-mark {
  display: flex;
  gap: 0.9rem;
  align-items: center;
}
.with-mark :deep(.sticker) { flex: none; }
</style>
