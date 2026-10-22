<template>
  <div
    v-if="admission.stored"
    class="tickets"
  >
    <Icon :name="tablerIcon('price')" size="22" />
    <div>
      <p class="label">
        Билеты
      </p>
      <table v-if="admission.lines.length">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AdmissionView } from '~~/shared/admission'
import { ADMISSION_UNKNOWN } from '~~/shared/admission'
import { tablerIcon } from '~~/shared/icons'

defineProps<{ admission: AdmissionView }>()
</script>

<style scoped>
.tickets {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 0.7rem;
  padding: 0.8rem 0;
  border-top: 1px dashed var(--color-line);
}
.tickets svg {
  width: 22px;
  height: 22px;
  margin-top: 0.15rem;
  fill: none;
  stroke: var(--color-brick);
  stroke-width: 1.7;
}
.tickets p { margin: 0; font-size: 0.97rem; line-height: 1.45; }
.tickets .label {
  margin-bottom: 0.3rem;
  color: var(--muted);
  font: 600 0.72rem/1 var(--font-body);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
table { width: 100%; border-collapse: collapse; font-size: 0.97rem; }
th,
td { padding: 0.3rem 0; vertical-align: baseline; }
tr + tr th,
tr + tr td { border-top: 1px dotted var(--color-line); }
th { padding-right: 0.8rem; font-weight: 400; text-align: left; line-height: 1.35; }
td { font-weight: 700; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.condition { display: block; margin-top: 0.1rem; color: var(--muted); font-size: 0.85rem; }
</style>
