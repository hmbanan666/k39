<template>
  <div class="page-modules">
    <template
      v-for="(module, index) in modules"
      :key="`${module.type}-${index}`"
    >
      <PageModuleText
        v-if="module.type === 'text'"
        :module="module"
      />
      <PageModuleMonthStats
        v-else-if="module.type === 'month-stats'"
        :module="module"
      />
      <PageModulePicker
        v-else-if="module.type === 'picker'"
        :questions="module.questions"
        :state="picker.state.value"
        :source="picker.source.value"
        :persona="picker.persona.value"
        :fitting="fitting"
        :total="total"
        @toggle="picker.toggle"
        @reset="picker.reset"
        @persona="picker.choosePersona"
      />
      <PageModuleCards
        v-else-if="module.type === 'ideas' || module.type === 'plans'"
        :module="module"
        :state="picker.state.value"
      />
      <PageModulePlaces
        v-else-if="module.type === 'places' && places.length"
        :title="module.title"
        :places="places"
        :state="picker.state.value"
      />
      <PageModuleMonths
        v-else-if="module.type === 'months' && months.length"
        :title="module.title"
        :months="months"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { PickerQuestion, PublicPageModule, PublicPlaceCard } from '~~/shared/page-modules'
import { fitsPicker, pickerActive, pickerFit } from '~~/shared/page-modules'

// Renders a module page (ADR 0023). Every module is server-rendered in its
// stored order; the picker only reorders and marks cards.
const props = defineProps<{
  modules: PublicPageModule[]
  places: Array<PublicPlaceCard & { media: PublicMedia | null }>
  months: { href: string, text: string, current: boolean }[]
}>()

const questions = computed<PickerQuestion[]>(() => {
  const module = props.modules.find((item) => item.type === 'picker')
  return module?.type === 'picker' ? module.questions : []
})
const picker = usePagePicker(questions.value)

const taggedCards = computed(() => [
  ...props.modules.flatMap((module) => module.type === 'ideas' || module.type === 'plans' ? module.items.map((item) => item.tags) : []),
  ...(props.modules.some((module) => module.type === 'places') ? props.places.map((place) => place.tags) : []),
])
const total = computed(() => taggedCards.value.length)
const fitting = computed(() => pickerActive(picker.state.value)
  ? taggedCards.value.filter((tags) => fitsPicker(pickerFit(tags, picker.state.value))).length
  : 0)
</script>

<style scoped>
.page-modules {
  display: grid;
  gap: var(--space-6);
  margin-top: var(--space-5);
}
/* Grid items may shrink below their content, so a scrolling chip row
   stays inside the page instead of widening it. */
.page-modules > * { min-width: 0; }
</style>
