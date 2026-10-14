import type { PickerQuestion, PickerState } from './page-modules'

// Visitor persona on the client (ADR 0026). The visitor picks it or it is
// inferred from picker answers; it lives in localStorage only and only fills
// picker hints after hydration. The server render never depends on it.

export const VISITOR_PERSONA_KEY = 'k39.persona'

export const VISITOR_PERSONAS = [
  { code: 'local', label: 'Я местный', hints: {} },
  { code: 'weekend', label: 'Турист', hints: {} },
  { code: 'family', label: 'С детьми', hints: { company: ['deti'] } },
  { code: 'nocar', label: 'Без машины', hints: { transport: ['bez-mashiny'] } },
] as const satisfies ReadonlyArray<{ code: string, label: string, hints: PickerState }>

export type VisitorPersona = (typeof VISITOR_PERSONAS)[number]['code']

export function isVisitorPersona(value: unknown): value is VisitorPersona {
  return VISITOR_PERSONAS.some((item) => item.code === value)
}

export function visitorPersonaLabel(code: VisitorPersona) {
  return VISITOR_PERSONAS.find((item) => item.code === code)!.label
}

/** Picker answers a persona implies, limited to the questions a page asks. */
export function personaHints(code: VisitorPersona | null, questions: readonly PickerQuestion[]): PickerState {
  const hints: PickerState = VISITOR_PERSONAS.find((item) => item.code === code)?.hints ?? {}
  const out: PickerState = {}
  for (const key of questions) {
    if (hints[key]?.length) {
      out[key] = [...hints[key]]
    }
  }
  return out
}

/** A persona the picker answers point to, or null when they say nothing about it. */
export function inferPersona(state: PickerState): VisitorPersona | null {
  if (state.company?.includes('deti')) {
    return 'family'
  }
  if (state.transport?.includes('bez-mashiny')) {
    return 'nocar'
  }
  return null
}
