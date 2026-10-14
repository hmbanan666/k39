<template>
  <div
    class="reader"
    :class="{ 'with-rail': showRail, 'has-lead': hasLead }"
  >
    <div
      ref="bodyRef"
      class="reader-body prose"
    >
      <slot name="body">
        <div
          class="reader-html"
          v-html="parts.before"
        />
      </slot>
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
      <slot name="after" />
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
          class="rail-toc"
          :items="tree"
          :active-id="activeId"
          :progress="progress"
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
import type { PageSection } from '~~/shared/page-sections'
import type { ReaderPartner } from '~~/shared/reader-nav'
import { activeHeadingId, HEADING_ALIASES, readerTree, showReaderToc, splitAfterFirstSection } from '~~/shared/reader-nav'

const props = withDefaults(defineProps<{
  html?: string
  partner?: ReaderPartner | null
  /** Page blocks before the body, from the shared section registry. */
  sectionsBefore?: PageSection[]
  /** Page blocks after the body, in page order. */
  sectionsAfter?: PageSection[]
}>(), {
  html: '',
  partner: null,
  sectionsBefore: () => [],
  sectionsAfter: () => [],
})

const slots = useSlots()
const hasLead = computed(() => Boolean(slots.lead))
const blockItems = (sections: PageSection[]) => sections.map((section) => ({ id: section.id, text: section.title, children: [] }))
const tree = computed(() => [...blockItems(props.sectionsBefore), ...readerTree(props.html), ...blockItems(props.sectionsAfter)])
const showToc = computed(() => showReaderToc(props.html, props.sectionsBefore.length + props.sectionsAfter.length))
const showRail = computed(() => showToc.value || Boolean(props.partner))
const parts = computed(() => props.partner ? splitAfterFirstSection(props.html) : { before: props.html, after: '' })
const activeId = ref('')
const progress = ref(0)
const bodyRef = ref<HTMLElement | null>(null)

// A heading becomes current once it passes just below the sticky header.
function activationLine() {
  const styles = getComputedStyle(document.documentElement)
  return Number.parseFloat(styles.scrollPaddingTop) + 16
}

/** Elements the contents point at, body headings and page blocks alike. */
function tocTargets() {
  const ids = tree.value.flatMap((item) => [item.id, ...item.children.map((child) => child.id)])
  return ids.map((id) => document.getElementById(id)).filter((element): element is HTMLElement => Boolean(element))
}

function syncActive() {
  const root = bodyRef.value
  if (!root) {
    return
  }
  const box = root.getBoundingClientRect()
  const span = box.height - window.innerHeight + activationLine()
  progress.value = span > 0 ? Math.min(1, Math.max(0, (activationLine() - box.top) / span)) : 1
  const headings = tocTargets()
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

// A renamed section keeps its old anchor: #praktika lands on #polezno-znat.
function followAlias() {
  const old = decodeURIComponent(location.hash.slice(1))
  const target = HEADING_ALIASES[old]
  if (!target || document.getElementById(old)) {
    return
  }
  const element = document.getElementById(target)
  if (element) {
    history.replaceState(history.state, '', `#${target}`)
    element.scrollIntoView()
  }
}

onMounted(() => {
  followAlias()
  if (!showToc.value || typeof IntersectionObserver === 'undefined') {
    return
  }
  const root = bodyRef.value
  if (!root) {
    return
  }
  const headings = tocTargets()
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
  window.addEventListener('scroll', schedule, { passive: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', schedule)
  window.removeEventListener('scroll', schedule)
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
    top: calc(var(--site-header-offset) + 1rem);
    max-height: calc(100dvh - var(--site-header-offset) - 2rem);
    overflow: auto;
  }
  .reader.with-rail .partner-inline { display: none; }
  .reader.with-rail .rail-toc {
    padding: 1rem 0.9rem 0.9rem;
    border: 1px solid var(--color-line);
    border-radius: 14px;
    background: var(--color-surface);
    box-shadow: 0 1px 2px rgb(43 36 32 / 6%);
  }
}
</style>
