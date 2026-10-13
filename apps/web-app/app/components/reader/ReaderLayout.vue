<template>
  <div
    class="reader"
    :class="{ 'with-rail': showRail, 'has-lead': hasLead }"
  >
    <div
      ref="bodyRef"
      class="reader-body prose"
    >
      <div
        class="reader-html"
        v-html="parts.before"
      />
      <div
        v-if="partner"
        class="partner-inline"
      >
        <ReaderPartnerSlot :partner="partner" />
      </div>
      <div
        v-if="partner && parts.after"
        class="reader-html"
        v-html="parts.after"
      />
    </div>
    <aside
      v-if="hasLead || showRail"
      class="reader-side"
    >
      <div
        v-if="hasLead"
        class="reader-lead"
      >
        <slot name="lead" />
      </div>
      <details
        v-if="showToc"
        class="reader-disclosure"
      >
        <summary>Содержание</summary>
        <ReaderToc
          :items="tree"
          :active-id="activeId"
        />
      </details>
      <div
        v-if="showRail"
        class="reader-rail"
      >
        <ReaderToc
          v-if="showToc"
          show-label
          :items="tree"
          :active-id="activeId"
        />
        <div
          v-if="partner"
          class="partner-rail"
        >
          <ReaderPartnerSlot :partner="partner" />
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import type { ReaderPartner } from '~~/shared/reader-nav'
import { activeHeadingId, readerTree, showReaderToc, splitAfterFirstSection } from '~~/shared/reader-nav'

const props = withDefaults(defineProps<{
  html: string
  partner?: ReaderPartner | null
}>(), {
  partner: null,
})

const slots = useSlots()
const hasLead = computed(() => Boolean(slots.lead))
const showToc = computed(() => showReaderToc(props.html))
const showRail = computed(() => showToc.value || Boolean(props.partner))
const tree = computed(() => showToc.value ? readerTree(props.html) : [])
const parts = computed(() => props.partner ? splitAfterFirstSection(props.html) : { before: props.html, after: '' })
const activeId = ref('')
const bodyRef = ref<HTMLElement | null>(null)

function activationLine() {
  const header = document.querySelector('.site-header')
  return (header?.getBoundingClientRect().height ?? 76) + 40
}

function syncActive() {
  const root = bodyRef.value
  if (!root) {
    return
  }
  const headings = [...root.querySelectorAll<HTMLElement>('h2[id], h3[id]')]
  activeId.value = activeHeadingId(
    headings.map((heading) => ({ id: heading.id, top: heading.getBoundingClientRect().top })),
    activationLine(),
  )
}

let observer: IntersectionObserver | undefined
let frame = 0

function schedule() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(syncActive)
}

onMounted(() => {
  if (!showToc.value || typeof IntersectionObserver === 'undefined') {
    return
  }
  const root = bodyRef.value
  if (!root) {
    return
  }
  const headings = [...root.querySelectorAll<HTMLElement>('h2[id], h3[id]')]
  if (!headings.length) {
    return
  }
  const top = Math.round(activationLine())
  observer = new IntersectionObserver(schedule, {
    rootMargin: `-${top}px 0px -45% 0px`,
    threshold: [0, 0.25, 0.5, 0.75, 1],
  })
  for (const heading of headings) {
    observer.observe(heading)
  }
  schedule()
  window.addEventListener('resize', schedule, { passive: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', schedule)
})
</script>

<style scoped>
.reader {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}
.reader-body {
  min-width: 0;
  max-width: 70ch;
}
.reader-side { display: contents; }
.reader-lead { order: 1; }
.reader-disclosure { order: 2; }
.reader-body { order: 3; }
.reader-rail { display: none; }
.reader-disclosure {
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-surface);
}
.reader-disclosure summary {
  padding: 0.85rem 1rem;
  color: var(--color-ink);
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
}
.reader-disclosure :deep(.toc) { padding: 0 0.85rem 0.9rem; }
.partner-inline { margin: 0.2rem 0 0.4rem; }
@media (min-width: 1000px) {
  .reader.has-lead:not(.with-rail) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 22.5rem;
    column-gap: 3.5rem;
    row-gap: 0;
    align-items: start;
  }
  .reader.has-lead:not(.with-rail) .reader-body {
    grid-column: 1;
    grid-row: 1;
    order: 0;
  }
  .reader.has-lead:not(.with-rail) .reader-side {
    display: block;
    grid-column: 2;
    grid-row: 1;
  }
}
@media (min-width: 1100px) {
  .reader.with-rail {
    display: grid;
    grid-template-columns: minmax(68ch, 70ch) minmax(16rem, 22.5rem);
    column-gap: clamp(2rem, 4vw, 3.5rem);
    row-gap: 0;
    align-items: stretch;
    justify-content: space-between;
  }
  .reader.with-rail .reader-body {
    grid-column: 1;
    grid-row: 1;
    align-self: start;
    order: 0;
  }
  .reader.with-rail .reader-side {
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
    grid-column: 2;
    grid-row: 1;
    align-self: stretch;
    min-width: 0;
  }
  .reader.with-rail .reader-lead,
  .reader.with-rail .reader-rail { order: 0; }
  .reader.with-rail .reader-disclosure { display: none; }
  .reader.with-rail .reader-rail {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    position: sticky;
    top: calc(var(--site-header-offset, 4.75rem) + 1rem);
    max-height: calc(100dvh - var(--site-header-offset, 4.75rem) - 2rem);
    overflow: auto;
    padding-bottom: 0.5rem;
    background-color: var(--bg);
  }
  .reader.with-rail .partner-inline { display: none; }
}
</style>
