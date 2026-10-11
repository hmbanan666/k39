<template>
  <article class="place-card">
    <a
      :href="href"
      class="cover"
    >
      <img
        v-if="image"
        :src="image.src"
        :alt="image.alt"
        :width="image.width || 640"
        :height="image.height || 400"
        loading="lazy"
      >
      <PostcardSketch
        v-else
        :label="title"
        :width="640"
        :height="400"
      />
      <h3>{{ title }}</h3>
    </a>
    <p
      v-if="summary"
      class="summary"
    >
      {{ summary }}
    </p>
    <p
      v-if="hub || distanceKm != null"
      class="meta"
    >
      <a
        v-if="hub && hubHref"
        :href="hubHref"
      >{{ hub }}</a>
      <span v-if="distanceKm != null">{{ distanceKm.toFixed(1) }} км</span>
    </p>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  href: string
  title: string
  hub?: string
  hubHref?: string
  summary?: string
  distanceKm?: number | null
  image?: { src: string, alt: string, width: number | null, height: number | null } | null
}>()
</script>

<style scoped>
.place-card {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.cover {
  color: inherit;
  text-decoration: none;
}
.cover:hover h3 { color: var(--color-brick); }
.paper,
img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background:
    linear-gradient(135deg, var(--color-sand), var(--color-foam));
}
.summary {
  color: var(--muted);
  font-size: var(--step--1);
}
.meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: auto;
  font-size: var(--step--1);
}
</style>
