<template>
  <div
    id="gostyam"
    class="guest-block"
  >
    <section
      v-if="notes.length"
      class="guest-notes"
      aria-labelledby="guest-notes-title"
    >
      <h2 id="guest-notes-title">
        От гостей
      </h2>
      <p class="disclaimer">
        {{ disclaimer }}
      </p>
      <article
        v-for="item in notes"
        :key="item.id"
        class="note"
      >
        <p class="meta">
          <span class="kind">{{ labels[item.kind] }}</span>
          {{ item.byline }}, {{ item.dateLabel }}
        </p>
        <p
          v-if="item.kind !== 'photo'"
          class="body"
        >
          <template
            v-for="(part, index) in item.parts"
            :key="index"
          >
            <a
              v-if="part.type === 'link'"
              :href="part.href"
              rel="ugc nofollow noopener noreferrer"
            >{{ part.text }}</a>
            <template v-else>
              {{ part.text }}
            </template>
          </template>
        </p>
        <MediaImage
          v-if="item.media"
          :media="item.media"
          :show-credit="false"
          sizes="(min-width: 900px) 640px, 100vw"
        />
      </article>
    </section>
    <GuestForm
      v-if="!staff"
      :subject-type="subjectType"
      :subject-slug="subjectSlug"
      :subject-path="subjectPath"
    />
  </div>
</template>

<script setup lang="ts">
import type { GuestPublicItem } from '~~/shared/guest'
import { GUEST_DISCLAIMER, GUEST_KIND_LABELS } from '~~/shared/guest'

const props = defineProps<{
  subjectType: 'place' | 'venue'
  subjectSlug: string
  subjectPath: string
  items?: GuestPublicItem[]
}>()

const notes = computed(() => props.items ?? [])
const disclaimer = GUEST_DISCLAIMER
const labels = GUEST_KIND_LABELS
const { loggedIn, user } = useUserSession()
const staff = computed(() => {
  const role = user.value?.role
  return loggedIn.value && (role === 'admin' || role === 'editor')
})
</script>

<style scoped>
.guest-block { margin-top: 2.4rem; }
.guest-notes h2 {
  margin: 0 0 0.45rem;
  font-size: var(--step-2);
}
.disclaimer {
  max-width: 62ch;
  margin: 0 0 1.1rem;
  color: var(--muted);
  line-height: 1.5;
}
.note {
  margin: 0 0 1.15rem;
  padding-left: 0.85rem;
  border-left: 3px solid var(--color-brick);
}
.meta {
  margin: 0 0 0.35rem;
  color: var(--muted);
  line-height: 1.4;
}
.kind {
  margin-right: 0.35rem;
  color: var(--color-brick-dark);
  font-family: var(--font-display);
  font-weight: 700;
}
.body {
  max-width: 62ch;
  margin: 0;
  line-height: 1.55;
  white-space: pre-wrap;
}
.body a { font-weight: 700; }
.note :deep(figure) { margin: 0.55rem 0 0; }
</style>
