import type { RenderedSection } from '../../../shared/facts'
import type { PageKind } from '../../../shared/scoring'
import { readSections, tables, useDatabase } from '@k39/database'
import { inArray, ne } from 'drizzle-orm'
import { articleSections, collectionSections, placeSections, questSections, venueSections } from '../../../shared/facts'
import { pageModulesSchema } from '../../../shared/page-modules'
import { venueModulesSchema } from '../../../shared/venue-modules'

const { categories, collections, places, quests, questSteps, routes, venues } = tables

export interface PageSnapshot {
  pageType: PageKind
  entityId: string
  path: string
  status: string | null
  sections: RenderedSection[]
}

const HUBS = ['forty', 'zamki', 'plyazhi', 'kurorty', 'muzei', 'eda']

/** Rendered prose for every page the fact layer can review. Archived rows stay out. */
export async function loadPageSnapshots(): Promise<PageSnapshot[]> {
  const db = useDatabase()
  const placeRows = await db
    .select({
      id: places.id,
      slug: places.slug,
      summary: places.summary,
      sections: places.sections,
      faq: places.faq,
      publicationStatus: places.publicationStatus,
    })
    .from(places)
    .where(ne(places.publicationStatus, 'archived'))
  const routeRows = await db
    .select({
      id: routes.id,
      slug: routes.slug,
      summary: routes.summary,
      sections: routes.sections,
      body: routes.body,
      publicationStatus: routes.publicationStatus,
    })
    .from(routes)
    .where(ne(routes.publicationStatus, 'archived'))
  const collectionRows = await db.select().from(collections).where(ne(collections.publicationStatus, 'archived'))
  const questRows = await db.select().from(quests).where(ne(quests.publicationStatus, 'archived'))
  const stepRows = questRows.length
    ? await db
        .select()
        .from(questSteps)
        .where(
          inArray(
            questSteps.questId,
            questRows.map((row) => row.id),
          ),
        )
    : []
  const hubRows = await db.select().from(categories).where(inArray(categories.slug, HUBS))
  const venueRows = await db
    .select({
      id: venues.id,
      slug: venues.slug,
      description: venues.description,
      modules: venues.modules,
      status: venues.status,
    })
    .from(venues)
    .where(ne(venues.status, 'archived'))

  const stepsByQuest = new Map<string, Array<{ title: string; prompt: string | null; position: number }>>()
  for (const step of stepRows) {
    const list = stepsByQuest.get(step.questId) ?? []
    list.push({ title: step.title, prompt: step.prompt, position: step.position })
    stepsByQuest.set(step.questId, list)
  }

  return [
    ...placeRows.map((row) => ({
      pageType: 'place' as const,
      entityId: row.id,
      path: `/${row.slug}`,
      status: row.publicationStatus,
      sections: placeSections({ summary: row.summary, sections: readSections(row.sections), faq: row.faq }),
    })),
    ...routeRows.map((row) => ({
      pageType: 'route' as const,
      entityId: row.id,
      path: `/marshruty/${row.slug}`,
      status: row.publicationStatus,
      sections: articleSections({ summary: row.summary, sections: readSections(row.sections), body: row.body }),
    })),
    ...collectionRows.map((row) => {
      const modules = pageModulesSchema.safeParse(row.modules)
      return {
        pageType: 'collection' as const,
        entityId: row.id,
        path: `/podborki/${row.slug}`,
        status: row.publicationStatus,
        sections: collectionSections({
          summary: row.summary,
          body: row.body,
          modules: modules.success && modules.data.length ? modules.data : null,
        }),
      }
    }),
    ...questRows.map((row) => ({
      pageType: 'quest' as const,
      entityId: row.id,
      path: `/kvesty/${row.slug}`,
      status: row.publicationStatus,
      sections: questSections({
        summary: row.summary,
        body: row.body,
        steps: (stepsByQuest.get(row.id) ?? []).sort((a, b) => a.position - b.position),
      }),
    })),
    ...hubRows.map((row) => ({
      pageType: 'hub' as const,
      entityId: row.id,
      path: `/${row.slug}`,
      status: null,
      sections: articleSections({ body: row.body }),
    })),
    ...venueRows.map((row) => {
      const modules = venueModulesSchema.safeParse(row.modules)
      return {
        pageType: 'venue' as const,
        entityId: row.id,
        path: `/zavedeniya/${row.slug}`,
        status: row.status,
        sections: venueSections({
          description: row.description,
          modules: modules.success ? modules.data : null,
        }),
      }
    }),
  ]
}

export async function loadPageSnapshot(pageType: PageKind, entityId: string) {
  const pages = await loadPageSnapshots()
  return pages.find((page) => page.pageType === pageType && page.entityId === entityId) ?? null
}
