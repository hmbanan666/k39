<template>
  <p
    v-if="status"
    class="live"
    :class="{ open: status.open, muted: status.muted, compact }"
    role="status"
  >
    <span class="dot" aria-hidden="true" />
    <span class="text">
      {{ status.text }}
      <span v-if="status.sub" class="sub">{{ status.sub }}</span>
    </span>
  </p>
  <p
    v-else-if="unverified"
    class="live muted"
    :class="{ compact }"
  >
    Часы не проверены, уточняйте
  </p>
  <p
    v-else-if="unknown && showUnknown"
    class="live muted"
    :class="{ compact }"
  >
    Часы неизвестны
  </p>
</template>

<script setup lang="ts">
import type { ScheduleRecord } from '~~/shared/schedule'
import { availabilityText, statusFromRules } from '~~/shared/schedule'

// Computed in the browser only, after hydration: cached HTML shows the
// schedule, never a stale «открыто сейчас».
const props = defineProps<{
  schedule: ScheduleRecord | null
  hasHours?: boolean
  /** Say «Часы неизвестны» instead of rendering nothing when there is no verified schedule. */
  showUnknown?: boolean
  /** Smaller type for list rows. */
  compact?: boolean
}>()
// Rendered only after hydration too, so cached HTML never carries it.
const unverified = ref(false)
const unknown = ref(false)
const status = ref<{ open: boolean, muted: boolean, text: string, sub?: string } | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

function update() {
  const now = new Date()
  const value = statusFromRules(props.schedule, now)
  // A closure's secondary part («снаружи можно посмотреть») goes on its own muted line.
  const [main, ...rest] = availabilityText(value, now).split(' · ')
  status.value = value.status === 'unknown'
    ? null
    : value.closure
      ? { open: false, muted: false, text: main ?? '', sub: rest.join(' · ') || undefined }
      : { open: !value.alwaysOpen && (value.status === 'open' || value.status === 'closing_soon'), muted: Boolean(value.alwaysOpen) || value.status === 'appointment' || Boolean(value.slot), text: [availabilityText(value, now), value.status === 'appointment' ? props.schedule?.rules.note : ''].filter(Boolean).join(': ') }
  unverified.value = value.status === 'unknown' && Boolean(props.hasHours)
  unknown.value = value.status === 'unknown'
}

onMounted(() => {
  update()
  timer = setInterval(update, 60_000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.live {
  display: flex;
  gap: 0.45rem;
  align-items: flex-start;
  line-height: 1.4;
  margin: 0.2rem 0 0.4rem;
  color: var(--color-brick-dark);
  font-size: 0.95rem;
  font-weight: 600;
}
.live.open { color: var(--color-success); }
.live.muted { color: var(--color-muted); font-weight: 400; font-size: 0.9rem; }
.live.compact { margin: 0.15rem 0 0; font-size: var(--step--1); }
.dot {
  width: 0.55rem;
  height: 0.55rem;
  flex-shrink: 0;
  /* Centre of the first text line. */
  margin-top: calc(0.7em - 0.275rem);
  border-radius: 50%;
  background: currentColor;
}
.sub {
  display: block;
  color: var(--color-muted);
  font-size: 0.85rem;
  font-weight: 400;
}
</style>
