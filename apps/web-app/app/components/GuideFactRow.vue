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
      <p
        v-if="row.links"
        class="links"
      >
        <template
          v-for="(link, index) in row.links"
          :key="`${link.href}-${index}`"
        >
          <a
            v-if="link.href.startsWith('tel:')"
            :href="link.href"
            data-track="outbound"
            data-track-name="phone"
          >{{ link.text }}</a>
          <UiLink
            v-else-if="link.href"
            :href="link.href"
            data-track="outbound"
            data-track-name="website"
          >
            {{ link.text }}
          </UiLink>
          <span v-else>{{ link.text }}</span>
        </template>
      </p>
      <p v-else>
        {{ row.value }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GuideFact } from '~~/shared/place-guide'
import { tablerIcon } from '~~/shared/icons'

defineProps<{ row: Pick<GuideFact, 'label' | 'value' | 'links'> & { key: GuideFact['key'] | 'address' } }>()
</script>

<style scoped>
.fact {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 0.7rem;
  padding: 0.8rem 0;
  border-top: 1px dashed var(--color-line);
}
.fact:first-of-type { border-top: 0; }
.fact svg {
  width: 22px;
  height: 22px;
  margin-top: 0.15rem;
  fill: none;
  stroke: var(--color-brick);
  stroke-width: 1.7;
}
.fact p { margin: 0; font-size: 0.97rem; line-height: 1.45; }
.fact .label {
  margin-bottom: 0.3rem;
  color: var(--muted);
  font: 600 0.72rem/1 var(--font-body);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.fact a { font-weight: 600; }
.links {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  overflow-wrap: anywhere;
}
</style>
