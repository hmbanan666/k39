import type { VisitorPersona } from '~~/shared/visitor-persona'
import { isVisitorPersona, VISITOR_PERSONA_KEY } from '~~/shared/visitor-persona'

/**
 * The visitor's persona, kept in localStorage only (ADR 0026). It is null on
 * the server and during hydration, so the server render never changes.
 */
export function useVisitorPersona() {
  const persona = useState<VisitorPersona | null>('visitor-persona', () => null)
  const explicit = useState<boolean>('visitor-persona-explicit', () => false)

  onMounted(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(VISITOR_PERSONA_KEY) ?? 'null') as {
        code?: unknown
        explicit?: unknown
      } | null
      if (raw && isVisitorPersona(raw.code)) {
        persona.value = raw.code
        explicit.value = raw.explicit === true
      }
    } catch {
      // Storage can be off or hold an old value; start without a persona.
    }
  })

  function save(code: VisitorPersona | null, chosen: boolean) {
    persona.value = code
    explicit.value = chosen && code !== null
    try {
      if (code) {
        localStorage.setItem(VISITOR_PERSONA_KEY, JSON.stringify({ code, explicit: explicit.value }))
      } else {
        localStorage.removeItem(VISITOR_PERSONA_KEY)
      }
    } catch {
      // Without storage the choice still applies to this page.
    }
  }

  /** An explicit choice always wins over an inferred one. */
  function infer(code: VisitorPersona | null) {
    if (code && !explicit.value && code !== persona.value) {
      save(code, false)
    }
  }

  return {
    persona: readonly(persona),
    explicit: readonly(explicit),
    choose: (code: VisitorPersona | null) => save(code, true),
    infer,
  }
}
