<template>
  <section
    v-if="steps.length"
    :class="{ band }"
  >
    <h2>{{ title }}</h2>
    <ol>
      <li
        v-for="(step, index) in steps"
        :key="step.href"
      >
        <span class="n">{{ index + 1 }}</span>
        <a :href="step.href">{{ step.text }}</a>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  steps: Array<{ href: string, text: string }>
  band?: boolean
}>(), { band: false })
</script>

<style scoped>
ol { margin: 0; padding: 0; list-style: none; }
li {
  display: flex;
  gap: var(--space-3);
  align-items: baseline;
  padding: 0.65rem 0;
  border-top: 1px solid var(--color-line);
}
.band {
  margin-top: var(--space-5);
  padding: var(--space-5);
  border-radius: 20px;
  background: var(--color-sea);
  color: var(--color-surface);
}
.band h2,
.band a { color: inherit; }
.band li { border-top-color: rgb(255 251 243 / 25%); }
.n {
  display: inline-grid;
  width: 1.7rem;
  height: 1.7rem;
  place-items: center;
  border: 1px solid var(--color-brick);
  border-radius: 50%;
  color: var(--color-brick);
  font-size: var(--step--1);
  font-weight: 700;
}
</style>
