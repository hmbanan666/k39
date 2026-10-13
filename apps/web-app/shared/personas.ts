import { z } from 'zod'

// Persona registry (ADR 0024). Personas are an editorial tool: who a page is
// for and which questions it must answer. Titles and questions are UI copy.
// The registry lives in code so codes stay stable; pages store assignments.

export interface Persona {
  code: string
  title: string
  job: string
  questions: string[]
  /** Module types this visitor needs most, existing or planned. */
  modules: string[]
}

export const PERSONAS = [
  { code: 'weekend', title: 'Турист на выходные', job: 'Увидеть главное за два-три дня без суеты', questions: ['Что обязательно посмотреть', 'Сколько времени на каждое место', 'Где жить'], modules: ['plans', 'ideas', 'short-facts'] },
  { code: 'family', title: 'Семья с детьми', job: 'Чтобы детям было интересно и удобно', questions: ['С какого возраста', 'Есть ли туалет и можно ли с коляской', 'Где поесть с детьми', 'Что делать в дождь'], modules: ['picker', 'compare-table', 'eat-nearby', 'bad-weather'] },
  { code: 'nocar', title: 'Без машины', job: 'Доехать на электричке и автобусе и успеть обратно', questions: ['Как добраться', 'Сколько стоит дорога', 'Когда последний рейс'], modules: ['transport', 'plans', 'short-facts'] },
  { code: 'history', title: 'Любитель истории', job: 'Увидеть подлинное и понять контекст', questions: ['Что сохранилось', 'Можно ли попасть внутрь', 'Есть ли экскурсии'], modules: ['highlights', 'text', 'sources', 'route-steps'] },
  { code: 'sea', title: 'Ищет море', job: 'Пляж, вода и закат', questions: ['Какая вода', 'Какой ветер', 'Какой пляж выбрать', 'Где поесть у моря'], modules: ['sea-today', 'month-stats', 'places'] },
  { code: 'foodie', title: 'Гастро', job: 'Попробовать местное', questions: ['Что попробовать', 'Где и за сколько', 'Открыто ли сейчас'], modules: ['ideas', 'eat-nearby'] },
  { code: 'local', title: 'Местный', job: 'Найти новое рядом с домом на выходные', questions: ['Что нового', 'Какие события', 'Куда съездить за час'], modules: ['events', 'open-closed', 'plans'] },
  { code: 'returning', title: 'Приезжает снова', job: 'Не повторяться и копнуть глубже', questions: ['Какие малые города посмотреть', 'Что необычного'], modules: ['places', 'route-steps', 'quest'] },
  { code: 'business', title: 'В командировке', job: 'Успеть главное рядом с центром за вечер', questions: ['Что успеть за два-три часа', 'Что открыто вечером', 'Что рядом с центром'], modules: ['plans', 'nearby', 'eat-nearby'] },
  { code: 'active', title: 'Активный отдых', job: 'Найти маршрут по силам', questions: ['Сколько километров', 'Какое покрытие', 'Где взять велосипед и воду'], modules: ['route-steps', 'route-map', 'short-facts'] },
  { code: 'quest', title: 'Квесты', job: 'Пройти интересно', questions: ['Сколько длится', 'Насколько сложно', 'Что в конце'], modules: ['quest', 'route-steps'] },
] as const satisfies readonly Persona[]

export type PersonaCode = (typeof PERSONAS)[number]['code']
export const PERSONA_CODES = PERSONAS.map((persona) => persona.code) as [PersonaCode, ...PersonaCode[]]

export function personaTitle(code: string) {
  return PERSONAS.find((persona) => persona.code === code)?.title ?? code
}

/** A page persona list: codes from the registry, weight 1..3, one primary. */
export const pagePersonasSchema = z.array(z.object({
  code: z.enum(PERSONA_CODES),
  weight: z.number().int().min(1).max(3).default(1),
  primary: z.boolean().default(false),
})).max(PERSONAS.length).superRefine((rows, ctx) => {
  if (new Set(rows.map((row) => row.code)).size !== rows.length) {
    ctx.addIssue({ code: 'custom', message: 'Each persona appears once' })
  }
  if (rows.length && rows.filter((row) => row.primary).length !== 1) {
    ctx.addIssue({ code: 'custom', message: 'Exactly one persona must be primary' })
  }
})

export type PagePersonaInput = z.infer<typeof pagePersonasSchema>[number]

/** Stored rows in display order: primary first, then by weight. */
export function orderPagePersonas<T extends { personaCode: string, weight: number, primary: boolean }>(rows: readonly T[]) {
  return [...rows].sort((a, b) => Number(b.primary) - Number(a.primary) || b.weight - a.weight || a.personaCode.localeCompare(b.personaCode))
}
