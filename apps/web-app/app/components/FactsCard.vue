<template>
  <section class="facts">
    <h2>{{ title }}</h2>
    <slot />
    <p
      v-if="checked"
      class="checked"
    >
      <Icon
        :name="tablerIcon('checked')"
        size="16"
      />
      Проверено {{ checked }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { tablerIcon } from '~~/shared/icons'

withDefaults(defineProps<{ title?: string; checked?: string | null }>(), { title: 'Коротко', checked: null })
</script>

<style scoped>
.facts {
  position: relative;
  overflow: hidden;
  padding: 1.2rem 1.15rem 0.4rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.facts::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 6px;
  background: repeating-linear-gradient(
    90deg,
    var(--color-brick) 0 18px,
    transparent 18px 26px,
    var(--color-sea) 26px 44px,
    transparent 44px 52px
  );
}
.facts h2 {
  margin: 0.35rem 0 0.3rem;
  font-size: 1.35rem;
}
.checked {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin: 0;
  padding: 0.7rem 0 0.8rem;
  border-top: 1px dashed var(--color-line);
  color: var(--color-pine, var(--muted));
  font: 600 0.8rem/1.2 var(--font-body);
}
.checked svg {
  flex: none;
}
</style>
