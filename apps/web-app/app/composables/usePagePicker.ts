import type { PickerQuestion, PickerState } from '~~/shared/page-modules'
import { parsePickerQuery, PICKER_PARAMS, PICKER_QUESTIONS, pickerQuery } from '~~/shared/page-modules'

/**
 * Picker answers live in the URL only (ADR 0023): a link can be shared, the
 * server renders the same order, and nothing is stored without consent.
 */
export function usePagePicker(questions: readonly PickerQuestion[]) {
  const route = useRoute()
  const router = useRouter()
  const state = computed<PickerState>(() => parsePickerQuery(route.query, questions))

  function write(next: PickerState) {
    const query: Record<string, string | null | (string | null)[]> = {}
    for (const [key, value] of Object.entries(route.query)) {
      if (!PICKER_PARAMS.includes(key)) {
        query[key] = value as string | null | (string | null)[]
      }
    }
    void router.replace({ query: { ...query, ...pickerQuery(next) } })
  }

  function toggle(question: PickerQuestion, value: string) {
    const current = state.value[question] ?? []
    const selected = current.includes(value)
    const values = PICKER_QUESTIONS[question].multiple
      ? (selected ? current.filter((item) => item !== value) : [...current, value])
      : (selected ? [] : [value])
    write({ ...state.value, [question]: values })
  }

  function reset() {
    write({})
  }

  return { state, toggle, reset }
}
