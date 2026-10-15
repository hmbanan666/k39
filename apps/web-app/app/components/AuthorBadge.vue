<template>
  <p class="badge">
    <MetaLink
      v-if="profileHref"
      class="who"
      :href="profileHref"
    >
      <span class="avatar">
        <img
          v-if="author.avatarUrl"
          :src="author.avatarUrl"
          alt=""
        >
        <span v-else>{{ initials }}</span>
      </span>
      <span class="name">{{ author.name }}</span>
    </MetaLink>
    <span
      v-else
      class="who"
    >
      <span class="avatar">
        <img
          v-if="author.avatarUrl"
          :src="author.avatarUrl"
          alt=""
        >
        <span v-else>{{ initials }}</span>
      </span>
      <span class="name">{{ author.name }}</span>
    </span>
    <MetaLink
      v-if="licenseUrl"
      class="license"
      :href="licenseUrl"
    >
      {{ label }}
    </MetaLink>
    <span
      v-else-if="label"
      class="license"
    >{{ label }}</span>
    <MetaLink
      v-if="author.sourceUrl"
      class="source"
      :href="author.sourceUrl"
    >
      Источник
    </MetaLink>
  </p>
</template>

<script setup lang="ts">
import type { AuthorBadgeData } from '~~/shared/media'
import { authorInitials, licenseHref, licenseLabel } from '~~/shared/media'

const props = defineProps<{ author: AuthorBadgeData }>()
const initials = computed(() => authorInitials(props.author.name))
const label = computed(() => licenseLabel(props.author.license))
const licenseUrl = computed(() => licenseHref(props.author.license))
const profileHref = computed(() => props.author.profileUrl || '')
</script>

<style scoped>
.badge {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.7rem;
  max-width: 100%;
  margin: 0;
  padding: 0.35rem 0.7rem 0.35rem 0.35rem;
  border: 1px solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink);
  font: 600 0.82rem/1.2 var(--font-body);
  box-shadow: var(--shadow-card);
}
.who {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.avatar {
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-brick);
  color: var(--color-paper);
  font-size: 0.68rem;
  letter-spacing: 0.02em;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.license,
.source {
  color: var(--color-sea);
  font-weight: 700;
  text-decoration: none;
}
.license:hover,
.source:hover,
.who:hover { color: var(--color-brick); }
</style>
