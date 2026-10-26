import type { PickerQuestion, PickerState } from '~~/shared/page-modules'
import { parsePickerQuery, PICKER_PARAMS, PICKER_QUESTIONS, pickerActive, pickerQuery } from '~~/shared/page-modules'
import { inferPersona, personaHints } from '~~/shared/visitor-persona'

/**
 * Picker answers live in the URL only (ADR 0023): a link can be shared, the
 * server renders the same order. Without answers in the URL, a visitor
 * persona from localStorage (ADR 0026) fills hints after hydration only.
 */
export function usePagePicker(questions: readonly PickerQuestion[]) {
  const route = useRoute()
  const router = useRouter()
  const visitor = useVisitorPersona()
  const answers = computed<PickerState>(() => parsePickerQuery(route.query, questions))
  const hinted = computed<PickerState>(() => personaHints(visitor.persona.value, questions))
  /** Where the current order comes from: the visitor's answers, their persona, or nothing. */
  const source = computed<'answers' | 'persona' | null>(() => {
    if (pickerActive(answers.value)) {
      return 'answers'
    }
    return pickerActive(hinted.value) ? 'persona' : null
  })
  const state = computed<PickerState>(() => (source.value === 'persona' ? hinted.value : answers.value))

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
      ? selected
        ? current.filter((item) => item !== value)
        : [...current, value]
      : selected
        ? []
        : [value]
    const next = { ...state.value, [question]: values }
    visitor.infer(inferPersona(next))
    write(next)
  }

  function reset() {
    if (source.value === 'persona') {
      visitor.choose(null)
    }
    write({})
  }

  return { state, source, toggle, reset, persona: visitor.persona, choosePersona: visitor.choose }
}
