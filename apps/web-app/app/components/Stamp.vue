<template>
  <div
    class="stamp"
    :class="size"
  >
    <div class="inner">
      <img
        v-if="src"
        :src="src"
        alt=""
        width="160"
        height="200"
      >
      <b
        v-else
        class="mark"
      >{{ label }}</b>
      <span v-if="src && label">{{ label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  src?: string
  label?: string
  size?: 'sm' | 'md'
}>(), {
  src: '',
  label: '',
  size: 'md',
})
</script>

<style scoped>
.stamp {
  --perf: 6px;
  --step: calc(var(--perf) * 2);
  position: relative;
  width: 7rem;
  padding: 7px;
  background: var(--color-surface);
  filter: drop-shadow(var(--shadow-stamp));
  -webkit-mask:
    radial-gradient(circle at center, transparent 0 calc(var(--perf) / 2 - 0.5px), #000 calc(var(--perf) / 2))
    calc(var(--step) / -2) calc(var(--step) / -2) / var(--step) var(--step),
    linear-gradient(#000 0 0) var(--perf) var(--perf) / calc(100% - var(--step)) calc(100% - var(--step)) no-repeat;
  -webkit-mask-composite: source-over;
  mask:
    radial-gradient(circle at center, transparent 0 calc(var(--perf) / 2 - 0.5px), #000 calc(var(--perf) / 2))
    calc(var(--step) / -2) calc(var(--step) / -2) / var(--step) var(--step),
    linear-gradient(#000 0 0) var(--perf) var(--perf) / calc(100% - var(--step)) calc(100% - var(--step)) no-repeat;
  mask-composite: add;
}
.sm {
  --perf: 4px;
  width: 3.5rem;
  padding: 5px;
}
.inner {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1.5px solid var(--color-brick);
  background: var(--color-surface);
}
img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
}
span,
.mark {
  margin: 0;
  padding: 0.2rem 0.15rem 0.15rem;
  color: var(--color-brick-dark);
  font-family: var(--font-stamp);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: center;
  text-transform: uppercase;
}
.mark {
  display: grid;
  aspect-ratio: 1;
  place-items: center;
  padding: 0.35rem;
  font-size: 0.95rem;
  letter-spacing: 0.04em;
}
.sm .mark { font-size: 0.78rem; }
</style>
