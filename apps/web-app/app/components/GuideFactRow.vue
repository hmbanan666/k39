<template>
  <div class="fact">
    <Icon
      :name="tablerIcon(row.key)"
      size="22"
    />
    <div>
      <p class="label">
        {{ row.label }}
      </p>
      <slot>
        <PhoneLinks
          v-if="row.phones"
          :phones="row.phones"
        />
        <p
          v-else-if="row.href"
          class="site"
        >
          <UiLink
            :href="row.href"
            data-track="outbound"
            data-track-name="website"
          >
            {{ row.value }}
          </UiLink>
        </p>
        <p v-else>
          {{ row.value }}
        </p>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GuideFact } from '~~/shared/place-guide'
import { tablerIcon } from '~~/shared/icons'

defineProps<{ row: Partial<Pick<GuideFact, 'value' | 'phones' | 'href'>> & { key: string; label: string } }>()
</script>

<style scoped>
.fact {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 0.7rem;
  padding: 0.8rem 0;
  border-top: 1px dashed var(--color-line);
}
.fact:first-of-type {
  border-top: 0;
}
.fact svg {
  width: 22px;
  height: 22px;
  margin-top: 0.15rem;
  color: var(--color-brick);
}
.fact p,
.fact :slotted(p) {
  margin: 0;
  font-size: 0.97rem;
  line-height: 1.45;
}
.fact .label {
  margin-bottom: 0.3rem;
  color: var(--muted);
  font: 600 0.72rem/1 var(--font-body);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.fact :deep(a) {
  font-weight: 600;
}
.site {
  overflow-wrap: anywhere;
}
</style>
