<template>
  <form
    class="search-form"
    :class="`search-form-${size}`"
    action="/poisk"
    method="get"
    role="search"
  >
    <label
      class="visually-hidden"
      :for="inputId"
    >Поиск по сайту</label>
    <Icon
      class="icon"
      :name="tablerIcon('search')"
      size="18"
      aria-hidden="true"
    />
    <input
      :id="inputId"
      name="q"
      type="search"
      :value="query"
      :placeholder="placeholder"
      autocomplete="off"
      enterkeyhint="search"
      maxlength="100"
      required
    >
    <input
      type="hidden"
      name="s"
      :value="surface"
    >
    <button
      v-if="size === 'large'"
      type="submit"
      class="btn"
    >
      Найти
    </button>
  </form>
</template>

<script setup lang="ts">
import { tablerIcon } from '~~/shared/icons'

// A plain GET form (ADR 0030): works without JavaScript and lands on /poisk.
withDefaults(defineProps<{
  surface: 'header' | 'page' | '404'
  size?: 'compact' | 'large'
  query?: string
  placeholder?: string
}>(), {
  size: 'compact',
  query: '',
  placeholder: 'Форт, замок, кафе…',
})

const inputId = useId()
</script>

<style scoped>
.search-form {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.icon {
  position: absolute;
  left: 0.7rem;
  color: var(--muted);
  pointer-events: none;
}
input[type='search'] {
  width: 100%;
  min-width: 0;
  height: 2.5rem;
  padding: 0 0.75rem 0 2.2rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--text);
  font: 400 0.95rem/1 var(--font-body);
}
input[type='search']:focus-visible {
  border-color: var(--color-sea);
  outline: 2px solid var(--color-sea-light);
}
.search-form-large input[type='search'] {
  height: 3rem;
  font-size: 1.05rem;
}
.search-form-large .icon { left: 0.9rem; }
.search-form-large input[type='search'] { padding-left: 2.5rem; }
.search-form-large .btn { flex: none; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
