import type { PageKind } from '@k39/database'
import { db } from '@k39/database'
import { orderPagePersonas, personaTitle } from '../../../shared/personas'

/** Adds each page's personas (primary first) to score rows for the admin table. */
export async function withPagePersonas<T extends { pageType: PageKind, entityId: string }>(rows: T[]) {
  const stored = await db.scoring.listPagePersonas()
  const byPage = new Map<string, typeof stored>()
  for (const row of stored) {
    const key = `${row.pageType}:${row.entityId}`
    byPage.set(key, [...(byPage.get(key) ?? []), row])
  }
  return rows.map((row) => ({
    ...row,
    personas: orderPagePersonas(byPage.get(`${row.pageType}:${row.entityId}`) ?? []).map((item) => ({
      code: item.personaCode,
      title: personaTitle(item.personaCode),
      weight: item.weight,
      primary: item.primary,
    })),
  }))
}
