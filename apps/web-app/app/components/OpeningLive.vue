<template>
  <p
    v-if="status"
    class="live"
    :class="{ open: status.open }"
    role="status"
  >
    <span class="dot" aria-hidden="true" />{{ status.text }}
  </p>
  <p
    v-else-if="unverified"
    class="live muted"
  >
    Часы не проверены, уточняйте
  </p>
</template>

<script setup lang="ts">
import type { ScheduleRecord } from '~~/shared/schedule'
import { availabilityText, statusFromRules } from '~~/shared/schedule'

// Computed in the browser only, after hydration: cached HTML shows the
// schedule, never a stale «открыто сейчас».
const props = defineProps<{ schedule: ScheduleRecord | null, hasHours?: boolean }>()
// Rendered only after hydration too, so cached HTML never carries it.
const unverified = ref(false)
const status = ref<{ open: boolean, text: string } | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

function update() {
  const now = new Date()
  const value = statusFromRules(props.schedule, now)
  status.value = value.status === 'unknown'
    ? null
    : { open: value.status === 'open' || value.status === 'closing_soon', text: availabilityText(value, now) }
  unverified.value = value.status === 'unknown' && Boolean(props.hasHours)
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
  align-items: center;
  margin: 0.2rem 0 0.4rem;
  color: var(--color-brick-dark);
  font-size: 0.95rem;
  font-weight: 600;
}
.live.open { color: var(--color-success); }
.live.muted { color: var(--color-muted); font-weight: 400; font-size: 0.9rem; }
.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: currentColor;
}
</style>
