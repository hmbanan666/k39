<template>
  <GuideFactRow
    v-for="group in groups"
    :key="group.key"
    :row="{ key: 'price', label: group.label }"
  >
    <table
      v-if="group.lines.length"
      class="tickets"
    >
      <tbody>
        <tr
          v-for="line in group.lines"
          :key="line.slot"
        >
          <th scope="row">
            {{ line.label }}
            <span
              v-if="line.condition"
              class="condition"
              >{{ line.condition }}</span
            >
            <span class="provenance">
              <UiLink
                :href="line.sourceUrl"
                external
                >{{ line.sourceTitle }}</UiLink
              >
              <span
                >Проверено <time :datetime="line.checkedAt">{{ formatPriceDate(line.checkedAt) }}</time></span
              >
            </span>
          </th>
          <td>
            {{ line.amount }}
            <span
              v-if="line.unit"
              class="unit"
              >{{ line.unit }}</span
            >
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>
      {{ group.unknown }}
    </p>
  </GuideFactRow>
</template>

<script setup lang="ts">
import type { AdmissionLine, AdmissionView } from '~~/shared/admission'
import { ADMISSION_EXTRAS_UNKNOWN, ADMISSION_UNKNOWN } from '~~/shared/admission'
import { formatPriceDate } from '~~/shared/price-compare'

const props = defineProps<{ admission: AdmissionView; legacyPrice?: string | null }>()
const groups = computed(() => {
  const result: Array<{ key: string; label: string; lines: AdmissionLine[]; unknown: string }> = []
  if (props.admission.stored || (props.admission.extrasStored && !props.legacyPrice?.trim())) {
    result.push({ key: 'entry', label: 'Билеты', lines: props.admission.lines, unknown: ADMISSION_UNKNOWN })
  }
  if (props.admission.extrasStored) {
    result.push({
      key: 'extra',
      label: 'Дополнительно',
      lines: props.admission.extraLines,
      unknown: ADMISSION_EXTRAS_UNKNOWN,
    })
  }
  return result
})
</script>

<style scoped>
.tickets {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.97rem;
}
th,
td {
  padding: 0.3rem 0;
  vertical-align: top;
}
tr + tr th,
tr + tr td {
  border-top: 1px dotted var(--color-line);
}
th {
  padding-right: 0.8rem;
  font-weight: 400;
  text-align: left;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
td {
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.condition,
.unit,
.provenance {
  display: block;
  margin-top: 0.15rem;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 400;
}
.provenance span {
  display: block;
}
</style>
