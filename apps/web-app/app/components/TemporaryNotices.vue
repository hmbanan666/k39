<template>
  <aside
    v-if="variant === 'hero' && lines.length"
    class="notices-hero"
    :aria-labelledby="headingId"
  >
    <h2
      :id="headingId"
      class="notices-title"
    >
      На эти даты
    </h2>
    <ul>
      <li
        v-for="line in lines"
        :key="line.key"
        :class="[`kind-${line.kind}`, `state-${line.state}`]"
      >
        <p class="dates">
          {{ line.dates }}
        </p>
        <p class="what">
          <strong v-if="line.label">{{ line.label }}.</strong>
          {{ line.text }}
        </p>
        <p
          v-if="line.address"
          class="where"
        >
          {{ line.address }}
        </p>
      </li>
    </ul>
  </aside>
  <template v-else-if="variant === 'facts'">
    <GuideFactRow
      v-for="line in lines"
      :key="line.key"
      :row="{ key: `notice-${line.kind}`, label: line.label ?? 'На эти даты' }"
    >
      <p
        v-if="line.address"
        class="fact-where"
      >
        {{ line.address }}
      </p>
      <p class="fact-dates">
        {{ line.dates }}
      </p>
      <p>{{ line.text }}</p>
    </GuideFactRow>
  </template>
</template>

<script setup lang="ts">
import type { PublicNotice } from '~~/shared/notices'
import { noticeLines } from '~~/shared/notices'

// Dated notices (ADR 0049). The server sends only current and upcoming rows,
// already in display order; this component only prints them. The hero banner
// and «Коротко» share `noticeLines`, so the two cannot drift.
const props = defineProps<{
  notices: Array<Pick<PublicNotice, 'kind' | 'from' | 'to' | 'text' | 'address' | 'state'>> | null | undefined
  variant: 'hero' | 'facts'
}>()

const headingId = useId()
const lines = computed(() => (props.notices ?? []).map((notice, index) => ({
  key: `${notice.kind}-${notice.from}-${index}`,
  kind: notice.kind,
  state: notice.state,
  ...noticeLines(notice),
})))
</script>

<style scoped>
.notices-hero {
  max-width: 34rem;
  margin: 1.1rem 0 0;
  padding: 0.85rem 1rem 0.9rem;
  border: 1px solid var(--color-sand);
  border-left: 4px solid var(--color-brick);
  border-radius: 4px 12px 12px 4px;
  background: var(--color-amber-soft);
  color: var(--color-ink);
}
.notices-title {
  margin: 0 0 0.45rem;
  color: var(--color-brick-dark);
  font: 700 1rem/1.2 var(--font-body);
  letter-spacing: 0;
}
.notices-hero ul { margin: 0; padding: 0; list-style: none; }
.notices-hero li + li {
  margin-top: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px dashed var(--color-sand);
}
.notices-hero p { margin: 0; line-height: 1.45; }
.notices-hero .dates { color: var(--color-brick-dark); font-weight: 700; }
.notices-hero .state-upcoming .dates { color: var(--color-muted); }
.notices-hero .what { font-size: 0.97rem; }
.notices-hero .where {
  margin-top: 0.15rem;
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-style: italic;
}

.fact-where { font-weight: 600; }
.fact-dates { color: var(--color-brick-dark); font-weight: 600; }
</style>
