<template>
  <GuideFactRow
    v-if="admission.stored"
    :row="{ key: 'price', label: 'Билеты' }"
  >
    <table
      v-if="admission.lines.length"
      class="tickets"
    >
      <tbody>
        <tr
          v-for="line in admission.lines"
          :key="line.slot"
        >
          <th scope="row">
            {{ line.label }}
            <span
              v-if="line.condition"
              class="condition"
            >{{ line.condition }}</span>
          </th>
          <td>{{ line.amount }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else>
      {{ ADMISSION_UNKNOWN }}
    </p>
  </GuideFactRow>
</template>

<script setup lang="ts">
import type { AdmissionView } from '~~/shared/admission'
import { ADMISSION_UNKNOWN } from '~~/shared/admission'

defineProps<{ admission: AdmissionView }>()
</script>

<style scoped>
.tickets { width: 100%; border-collapse: collapse; font-size: 0.97rem; }
th,
td { padding: 0.3rem 0; vertical-align: baseline; }
tr + tr th,
tr + tr td { border-top: 1px dotted var(--color-line); }
th { padding-right: 0.8rem; font-weight: 400; text-align: left; line-height: 1.35; }
td { font-weight: 700; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.condition { display: block; margin-top: 0.1rem; color: var(--muted); font-size: 0.85rem; }
</style>
