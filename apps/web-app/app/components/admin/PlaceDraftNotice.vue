<template>
  <section
    class="draft"
    aria-labelledby="place-draft-title"
  >
    <h2 id="place-draft-title">
      Черновик ждёт решения
    </h2>
    <p class="lead">
      Агент сохранил правки этой страницы. На сайте по-прежнему живой текст. Применить опубликует черновик. Отбросить оставит живую страницу.
    </p>
    <p class="meta">
      {{ pending.publicationStatus === 'review' ? 'На проверке' : 'Черновик' }}. {{ pending.updatedLabel }}
    </p>
    <p
      v-if="pending.changes.length === 0"
      class="same"
    >
      Поля совпадают с живой страницей.
    </p>
    <div
      v-for="change in pending.changes"
      :key="change.field"
      class="field"
    >
      <h3>{{ change.label }}</h3>
      <div class="pair">
        <div>
          <p class="who">
            Сейчас
          </p>
          <p class="sheet live">
            {{ change.live }}
          </p>
        </div>
        <div>
          <p class="who">
            В черновике
          </p>
          <p class="sheet next">
            {{ change.draft }}
          </p>
        </div>
      </div>
    </div>
    <div class="actions">
      <UiButton
        type="button"
        :disabled="busy"
        @click="emit('apply')"
      >
        Применить черновик
      </UiButton>
      <UiButton
        type="button"
        variant="quiet"
        :disabled="busy"
        @click="emit('discard')"
      >
        Отбросить черновик
      </UiButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PlaceDraftNotice } from '~~/shared/place-draft-diff'

defineProps<{
  pending: PlaceDraftNotice
  busy?: boolean
}>()

const emit = defineEmits<{
  apply: []
  discard: []
}>()
</script>

<style scoped>
.draft {
  margin: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-left: 4px solid var(--color-brick);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.draft h2 {
  margin: 0 0 var(--space-2);
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 700;
  line-height: 1.2;
}

.lead,
.meta,
.same {
  margin: 0 0 var(--space-3);
}

.lead {
  max-width: 62ch;
}

.meta,
.same {
  color: var(--muted);
}

.field {
  margin: 0 0 var(--space-4);
}

.field h3 {
  margin: 0 0 var(--space-2);
  font-family: var(--font-body);
  font-size: var(--step-0);
  font-weight: 700;
}

.pair {
  display: grid;
  gap: var(--space-3);
}

.who {
  margin: 0 0 var(--space-1);
  color: var(--muted);
  font-size: var(--step--1);
}

.sheet {
  margin: 0;
  max-height: 18rem;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.live {
  color: var(--muted);
}

.next {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-sea-light);
  color: var(--text);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.actions :deep(.btn) {
  flex: 1 1 12rem;
  height: auto;
  min-height: 2.6rem;
  white-space: normal;
  text-align: center;
}

@media (min-width: 720px) {
  .pair {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}
</style>
