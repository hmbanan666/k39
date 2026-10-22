import type { AdmissionRowWrite } from '@k39/database'
import type { FactActor } from '../../../shared/facts'
import type { PracticalTarget } from './target'
import { db } from '@k39/database'
import { createError } from 'h3'
import { z } from 'zod'
import { ADMISSION_AUDIENCES, ADMISSION_CONDITION_MAX, ADMISSION_LABEL_MAX, ADMISSION_MAX_ROWS, admissionRowProblem, admissionView, PRACTICAL_SLOT, sortAdmission } from '../../../shared/admission'
import { commitFact, retireFactSlot } from '../facts/commit'
import { rejectBannedSites, writingGate } from '../mcp/writing-guard'
import { admissionSourceProblem } from './sources'
import { isLivePractical, refuseDraftLivePractical } from './target'

export const admissionRowInput = z.object({
  slot: z.string().trim().regex(PRACTICAL_SLOT, 'slot: [a-z0-9-], до 40 символов'),
  audience: z.enum(ADMISSION_AUDIENCES),
  priceRub: z.number().int().nonnegative(),
  condition: z.string().trim().max(ADMISSION_CONDITION_MAX).nullable().optional(),
  label: z.string().trim().max(ADMISSION_LABEL_MAX).nullable().optional(),
  sourceUrl: z.string().trim().url(),
  sourceTitle: z.string().trim().min(1).max(200),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkedAt: YYYY-MM-DD'),
  sortOrder: z.number().int().min(0).max(1000).optional(),
})
export type AdmissionRowInput = z.infer<typeof admissionRowInput>

export const admissionListInput = z.array(admissionRowInput).max(ADMISSION_MAX_ROWS)

function slotKey(slot: string) {
  return `admission:${slot}`
}

function bad(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

/** Validates and normalizes the list. Throws 400 with the first problem. */
export function normalizeAdmission(rows: AdmissionRowInput[], now = new Date()): AdmissionRowWrite[] {
  if (rows.length > ADMISSION_MAX_ROWS) {
    bad(`Не больше ${ADMISSION_MAX_ROWS} строк билетов`)
  }
  const today = now.toISOString().slice(0, 10)
  const seen = new Set<string>()
  return rows.map((row, index) => {
    if (!PRACTICAL_SLOT.test(row.slot)) {
      bad(`slot «${row.slot}»: [a-z0-9-], до 40 символов`)
    }
    if (seen.has(row.slot)) {
      bad(`slot «${row.slot}» повторяется`)
    }
    seen.add(row.slot)
    const condition = row.condition?.trim() || null
    const label = row.label?.trim() || null
    const problem = admissionRowProblem({ audience: row.audience, priceRub: row.priceRub, condition, label })
      ?? admissionSourceProblem(row.sourceUrl)
    if (problem) {
      bad(`${row.slot}: ${problem}`)
    }
    if (Number.isNaN(Date.parse(`${row.checkedAt}T00:00:00Z`)) || row.checkedAt > today) {
      bad(`${row.slot}: checkedAt — день проверки, не в будущем`)
    }
    return {
      slot: row.slot,
      audience: row.audience,
      priceRub: row.priceRub,
      condition,
      label,
      sourceUrl: row.sourceUrl,
      sourceTitle: row.sourceTitle.trim(),
      checkedAt: row.checkedAt,
      sortOrder: row.sortOrder ?? index,
    }
  })
}

/**
 * Replaces the ticket list of one subject. A row that is left out retires its
 * fact. The draft token gets 409 on a live parent and nothing is stored.
 */
export async function setAdmission(target: PracticalTarget, input: AdmissionRowInput[], actor: FactActor) {
  refuseDraftLivePractical(target, 'admission prices')
  const rows = normalizeAdmission(input)
  rejectBannedSites(rows)
  const writingWarnings = writingGate({
    prose: rows.flatMap((row) => [row.condition, row.label]).filter(Boolean).join('\n'),
    publishing: isLivePractical(target),
  })
  const before = await db.admission.forSubject(target.type, target.id)
  const conflicts: string[] = []
  const saved = await db.admission.replace(target.type, target.id, rows)
  for (const row of saved) {
    const queued = await commitFact({
      kind: 'admission',
      subjectType: target.type,
      subjectId: target.id,
      slot: slotKey(row.slot),
      value: { audience: row.audience, priceRub: row.priceRub, condition: row.condition, label: row.label },
      sourceUrl: row.sourceUrl,
      sourceTitle: row.sourceTitle,
      sourceKind: 'official',
      checkedAt: `${row.checkedAt}T00:00:00.000Z`,
      confidence: 'stated',
      actor,
      refs: [{ consumerType: target.type, consumerId: target.id, path: 'short.tickets' }],
      pageType: target.type,
      pageStatus: target.status,
    })
    if (queued.conflict) {
      conflicts.push(queued.queueId)
    }
  }
  const kept = new Set(saved.map((row) => row.slot))
  for (const row of before) {
    if (!kept.has(row.slot)) {
      await retireFactSlot(target.type, target.id, slotKey(row.slot))
    }
  }
  return { rows: sortAdmission(saved), writingWarnings, ownerConflicts: conflicts }
}

export async function readAdmission(target: PracticalTarget, now = new Date()) {
  const rows = await db.admission.forSubject(target.type, target.id)
  const view = admissionView(rows, now)
  return { rows: sortAdmission(rows), shown: view.rows.map((row) => row.slot), stored: view.stored }
}

/** `fact_update` on an admission fact rewrites that one row through `setAdmission`. */
export async function updateAdmissionFact(target: PracticalTarget, slot: string, value: { audience: string, priceRub: number, condition: string | null, label: string | null }, source: { sourceUrl: string | null, sourceTitle: string | null, checkedAt: string | null }) {
  const rows = await db.admission.forSubject(target.type, target.id)
  const rowSlot = slot.replace(/^admission:/, '')
  const current = rows.find((row) => row.slot === rowSlot)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Строка билета не найдена' })
  }
  const next = rows.map((row) => ({
    slot: row.slot,
    audience: row.audience,
    priceRub: row.priceRub,
    condition: row.condition,
    label: row.label,
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    checkedAt: row.checkedAt,
    sortOrder: row.sortOrder,
  }))
  const index = next.findIndex((row) => row.slot === rowSlot)
  next[index] = {
    ...next[index]!,
    audience: value.audience as AdmissionRowInput['audience'],
    priceRub: value.priceRub,
    condition: value.condition,
    label: value.label,
    sourceUrl: source.sourceUrl ?? current.sourceUrl,
    sourceTitle: source.sourceTitle ?? current.sourceTitle,
    checkedAt: (source.checkedAt ?? new Date().toISOString()).slice(0, 10),
  }
  return setAdmission(target, next, 'mcp')
}
