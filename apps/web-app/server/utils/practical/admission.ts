import type { AdmissionRowWrite, ContentTx } from '@k39/database'
import type { AdmissionValue, FactActor } from '../../../shared/facts'
import type { PracticalTarget } from './target'
import process from 'node:process'
import { db } from '@k39/database'
import { createError } from 'h3'
import { z } from 'zod'
import {
  ADMISSION_AUDIENCES,
  ADMISSION_CONDITION_MAX,
  ADMISSION_EXTRA_MAX_ROWS,
  ADMISSION_EXTRA_UNITS,
  ADMISSION_LABEL_MAX,
  ADMISSION_MAX_ROWS,
  admissionRowProblem,
  admissionView,
  partitionAdmission,
  PRACTICAL_SLOT,
} from '../../../shared/admission'
import { localNow } from '../../../shared/schedule'
import { commitFact, retireFactSlot } from '../facts/commit'
import { rejectBannedSites, writingGate } from '../mcp/writing-guard'
import { admissionSourceProblem } from './sources'
import { isLivePractical, refuseDraftLivePractical } from './target'

const commonInput = {
  slot: z.string().trim().regex(PRACTICAL_SLOT, 'slot: [a-z0-9-], до 40 символов'),
  priceRub: z.number().int().nonnegative().max(2147483647),
  condition: z.string().trim().max(ADMISSION_CONDITION_MAX).nullable().optional(),
  sourceUrl: z.string().trim().url(),
  sourceTitle: z.string().trim().min(1).max(200),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkedAt: YYYY-MM-DD'),
  sortOrder: z.number().int().min(0).max(1000).optional(),
}
export const admissionRowInput = z.object({
  ...commonInput,
  audience: z.enum(ADMISSION_AUDIENCES),
  kind: z.literal('entry').optional(),
  unit: z.null().optional(),
  label: z.string().trim().max(ADMISSION_LABEL_MAX).nullable().optional(),
})
export const admissionExtraInput = z.object({
  ...commonInput,
  kind: z.literal('extra').optional(),
  audience: z.null().optional(),
  priceRub: commonInput.priceRub.positive(),
  label: z.string().trim().min(1).max(ADMISSION_LABEL_MAX),
  unit: z.enum(ADMISSION_EXTRA_UNITS).nullable().optional(),
})
export type AdmissionRowInput = z.infer<typeof admissionRowInput>
export type AdmissionExtraInput = z.infer<typeof admissionExtraInput>
export const admissionListInput = z.array(admissionRowInput).max(ADMISSION_MAX_ROWS)
export const admissionExtrasInput = z.array(admissionExtraInput).max(ADMISSION_EXTRA_MAX_ROWS)
export const admissionPatchInput = z
  .object({ rows: admissionListInput.optional(), extras: admissionExtrasInput.optional() })
  .strict()
  .refine((value) => value.rows !== undefined || value.extras !== undefined, 'Передайте билеты или допуслуги')
export type AdmissionPatch = z.infer<typeof admissionPatchInput>

/** Enable only after every deployed instance uses the partition-aware writer. */
export function admissionExtrasWriteEnabled() {
  return process.env.FEATURE_ADMISSION_EXTRAS_WRITE === 'true'
}

function slotKey(kind: 'entry' | 'extra', slot: string) {
  return `${kind === 'extra' ? 'admission-extra' : 'admission'}:${slot}`
}
function bad(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

/** Both public entry points and direct fact updates pass through these rules. */
function normalizeList(input: unknown[], kind: 'entry' | 'extra', now: Date): AdmissionRowWrite[] {
  const result = (kind === 'entry' ? admissionListInput : admissionExtrasInput).safeParse(input)
  if (!result.success) {
    bad(result.error.issues[0]?.message ?? 'Проверьте строки цен')
  }
  const today = localNow(now).date
  const seen = new Set<string>()
  return result.data.map((row, index) => {
    if (seen.has(row.slot)) {
      bad(`slot «${row.slot}» повторяется`)
    }
    seen.add(row.slot)
    const condition = row.condition?.trim() || null
    const label = row.label?.trim() || null
    const audience = 'audience' in row ? (row.audience ?? null) : null
    const problem =
      (audience ? admissionRowProblem({ audience, priceRub: row.priceRub, condition, label }) : null) ??
      admissionSourceProblem(row.sourceUrl)
    if (problem) {
      bad(`${row.slot}: ${problem}`)
    }
    const parsedDay = new Date(`${row.checkedAt}T00:00:00Z`)
    if (
      Number.isNaN(parsedDay.getTime()) ||
      parsedDay.toISOString().slice(0, 10) !== row.checkedAt ||
      row.checkedAt > today
    ) {
      bad(`${row.slot}: checkedAt: существующий день проверки, не в будущем`)
    }
    return {
      ...row,
      kind,
      audience,
      unit: 'unit' in row ? (row.unit ?? null) : null,
      condition,
      label,
      sortOrder: row.sortOrder ?? index,
    }
  })
}

export function normalizeAdmission(rows: AdmissionRowInput[], now = new Date()) {
  return normalizeList(rows, 'entry', now)
}

/** Replace supplied lists and their facts atomically; omitted lists are untouched. */
export async function setAdmission(
  target: PracticalTarget,
  input: AdmissionRowInput[] | AdmissionPatch,
  actor: FactActor,
  existingTx?: ContentTx,
) {
  refuseDraftLivePractical(target, 'admission prices')
  const parsed = admissionPatchInput.safeParse(Array.isArray(input) ? { rows: input } : input)
  if (!parsed.success) {
    bad(parsed.error.issues[0]?.message ?? 'Проверьте строки цен')
  }
  const patch = parsed.data
  if (patch.extras !== undefined && !admissionExtrasWriteEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'Сохранение допуслуг пока недоступно' })
  }
  const lists = {
    entry: patch.rows === undefined ? undefined : normalizeList(patch.rows, 'entry', new Date()),
    extra: patch.extras === undefined ? undefined : normalizeList(patch.extras, 'extra', new Date()),
  }
  const supplied = Object.values(lists).flatMap((rows) => rows ?? [])
  rejectBannedSites(supplied)
  const writingWarnings = writingGate({
    prose: supplied
      .flatMap((row) => [row.condition, row.label])
      .filter(Boolean)
      .join('\n'),
    publishing: isLivePractical(target),
  })
  const write = async (tx: ContentTx) => {
    await db.admission.lock(target.type, target.id, tx)
    const before = await db.admission.forSubject(target.type, target.id, tx)
    const conflicts: string[] = []
    for (const kind of ['entry', 'extra'] as const) {
      const rows = lists[kind]
      if (rows === undefined) {
        continue
      }
      const effective: AdmissionRowWrite[] = []
      for (const row of rows) {
        const queued = await commitFact(
          {
            kind: 'admission',
            subjectType: target.type,
            subjectId: target.id,
            slot: slotKey(kind, row.slot),
            value:
              kind === 'extra'
                ? { kind: 'extra', priceRub: row.priceRub, condition: row.condition, label: row.label, unit: row.unit }
                : { audience: row.audience, priceRub: row.priceRub, condition: row.condition, label: row.label },
            sourceUrl: row.sourceUrl,
            sourceTitle: row.sourceTitle,
            sourceKind: 'official',
            checkedAt: `${row.checkedAt}T00:00:00.000Z`,
            confidence: 'stated',
            actor,
            refs: [
              {
                consumerType: target.type,
                consumerId: target.id,
                path: kind === 'extra' ? 'short.admissionExtras' : 'short.tickets',
              },
            ],
            pageType: target.type,
            pageStatus: target.status,
          },
          tx,
        )
        if (queued.conflict) {
          conflicts.push(queued.queueId)
          const kept = before.find((item) => item.kind === kind && item.slot === row.slot)
          if (kept) {
            effective.push(kept)
          }
        } else {
          effective.push(row)
        }
      }
      for (const row of before.filter(
        (item) => item.kind === kind && !rows.some((candidate) => candidate.slot === item.slot),
      )) {
        const key = slotKey(kind, row.slot)
        const fact = await db.facts.liveSlot(target.type, target.id, key, tx)
        if (actor === 'mcp' && fact && (await db.facts.latestActor(fact.id, tx)) === 'owner') {
          throw createError({ statusCode: 409, statusMessage: 'Строку владельца может убрать только редактор' })
        }
        await retireFactSlot(target.type, target.id, key, tx)
      }
      lists[kind] = effective
    }
    const saved = await db.admission.replaceLists(target.type, target.id, lists, tx)
    return { ...admissionReadResult(saved), writingWarnings, ownerConflicts: conflicts }
  }
  return existingTx ? write(existingTx) : db.editor.transaction(write)
}

function admissionReadResult(rows: Awaited<ReturnType<typeof db.admission.forSubject>>, now = new Date()) {
  const view = admissionView(rows, now)
  return {
    ...partitionAdmission(rows),
    shown: view.rows.map((row) => row.slot),
    stored: view.stored,
    shownExtras: view.extras.map((row) => row.slot),
    extrasStored: view.extrasStored,
  }
}
export async function readAdmission(target: PracticalTarget, now = new Date()) {
  return admissionReadResult(await db.admission.forSubject(target.type, target.id), now)
}

/** Slot namespace selects the list; a value cannot convert an entry to an extra. */
export async function updateAdmissionFact(
  target: PracticalTarget,
  slot: string,
  value: AdmissionValue,
  source: { sourceUrl: string | null; sourceTitle: string | null; checkedAt: string | null },
) {
  const extra = slot.startsWith('admission-extra:')
  if ((!extra && !slot.startsWith('admission:')) || extra !== 'kind' in value) {
    bad('Значение факта не соответствует списку цен')
  }
  return db.editor.transaction(async (tx) => {
    await db.admission.lock(target.type, target.id, tx)
    const all = partitionAdmission(await db.admission.forSubject(target.type, target.id, tx))
    const rows = extra ? all.extras : all.rows
    const rowSlot = slot.slice(slot.indexOf(':') + 1)
    const current = rows.find((row) => row.slot === rowSlot)
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Строка цены не найдена' })
    }
    const next = rows.map((row) => {
      const common = {
        slot: row.slot,
        priceRub: row.priceRub,
        condition: row.condition,
        label: row.label,
        sourceUrl: row.sourceUrl,
        sourceTitle: row.sourceTitle,
        checkedAt: row.checkedAt,
        sortOrder: row.sortOrder,
      }
      const base = row.kind === 'extra' ? { ...common, unit: row.unit } : { ...common, audience: row.audience }
      if (row.slot !== rowSlot) {
        return base
      }
      const { kind: _kind, ...updated } = 'kind' in value ? value : { kind: undefined, ...value }
      return {
        ...base,
        ...updated,
        sourceUrl: source.sourceUrl ?? row.sourceUrl,
        sourceTitle: source.sourceTitle ?? row.sourceTitle,
        checkedAt: (source.checkedAt ?? new Date().toISOString()).slice(0, 10),
      }
    })
    // Validate the discriminated list at the writer boundary, including legacy values.
    return setAdmission(target, { [extra ? 'extras' : 'rows']: next } as AdmissionPatch, 'mcp', tx)
  })
}
