import type { CatalogSchedule, CatalogStop, ContentCatalog, PageMetric, StoredScore } from '@k39/database'
import type { LinkCatalog, PageKind, PageScore, PassportFields, ScoreSource } from '../../../shared/scoring'
import { collectionArticle } from '../../../shared/page-modules'
import { readRules, scheduleHoursKnown } from '../../../shared/schedule'
import { emptyResults, linkStats, scorePage, searchTotalsForPath } from '../../../shared/scoring'

/** Whether a catalog schedule row states known hours. The same rule for places and venues. */
export function catalogHoursKnown(schedule: CatalogSchedule | null | undefined) {
  return schedule ? scheduleHoursKnown({ rules: readRules(schedule.rules), verifiedAt: schedule.verifiedAt }) : false
}

export function catalogPageRefs(catalog: ContentCatalog) {
  return [
    ...catalog.places.map((row) => ({ pageType: 'place' as const, entityId: row.id, path: `/${row.slug}` })),
    ...catalog.routes.map((row) => ({ pageType: 'route' as const, entityId: row.id, path: `/marshruty/${row.slug}` })),
    ...catalog.collections.map((row) => ({ pageType: 'collection' as const, entityId: row.id, path: `/podborki/${row.slug}` })),
    ...catalog.quests.map((row) => ({ pageType: 'quest' as const, entityId: row.id, path: `/kvesty/${row.slug}` })),
    ...catalog.hubs.map((row) => ({ pageType: 'hub' as const, entityId: row.id, path: `/${row.slug}` })),
    ...catalog.venues.map((row) => ({ pageType: 'venue' as const, entityId: row.id, path: `/zavedeniya/${row.slug}` })),
  ]
}

function stopSlugs(stops: CatalogStop[], parentId: string, publishedOnly: boolean) {
  return stops
    .filter((stop) => stop.parentId === parentId && (!publishedOnly || stop.placePublished))
    .map((stop) => stop.placeSlug)
}

function passportOf(catalog: ContentCatalog, kind: PageKind, id: string): PassportFields | null {
  const row = catalog.passports.find((item) => item.pageType === kind && item.entityId === id)
  if (!row) {
    return null
  }
  return {
    targetQueries: row.targetQueries,
    audience: row.audience,
    primaryAction: row.primaryAction,
    goal30d: row.goal30d,
    goal90d: row.goal90d,
    notes: row.notes,
    lengthOverride: row.lengthOverride,
  }
}

function demandTargets(passport: PassportFields | null) {
  return [
    ...(passport?.targetQueries ?? []),
    ...(passport?.lengthOverride?.queries ?? []),
  ]
}

export interface ScoreInclude {
  kind: PageKind
  id: string
}

export function scoresFromCatalog(
  catalog: ContentCatalog,
  metrics: PageMetric[],
  queries: Array<{ page: string, query: string }>,
  searchImported: boolean,
  now = new Date(),
  factRefs?: Map<string, { count: number, stale: number }>,
  options?: { include?: ScoreInclude[] },
): PageScore[] {
  const linkCatalog: LinkCatalog = {
    places: catalog.places.map((place) => ({
      slug: place.slug,
      title: place.title,
      categorySlug: place.categorySlug,
      regionId: place.regionId,
      latitude: place.latitude,
      longitude: place.longitude,
      published: place.publicationStatus === 'published',
      noindex: place.noindex,
      body: place.body,
    })),
    routes: catalog.routes.map((route) => ({
      slug: route.slug,
      title: route.title,
      published: route.publicationStatus === 'published',
      noindex: route.noindex,
      placeSlugs: stopSlugs(catalog.routeStops, route.id, false),
      body: route.body,
    })),
    collections: catalog.collections.map((collection) => ({
      slug: collection.slug,
      title: collection.title,
      published: collection.publicationStatus === 'published',
      noindex: collection.noindex,
      placeSlugs: stopSlugs(catalog.collectionStops, collection.id, false),
      body: collectionArticle(collection),
    })),
    quests: catalog.quests.map((quest) => ({
      slug: quest.slug,
      title: quest.title,
      published: quest.publicationStatus === 'published',
      noindex: quest.noindex,
      placeSlugs: stopSlugs(catalog.questStops, quest.id, false),
      body: quest.body,
      routeSlug: quest.routeSlug,
    })),
    hubs: catalog.hubs.map((hub) => ({
      slug: hub.slug,
      title: hub.title,
      description: hub.description,
      body: hub.body,
      noindex: hub.noindex,
    })),
    venues: (catalog.venues ?? []).map((venue) => ({
      slug: venue.slug,
      published: venue.publicationStatus === 'published',
      noindex: venue.noindex,
      regionSlug: venue.regionSlug,
      latitude: venue.latitude,
      longitude: venue.longitude,
    })),
    related: catalog.related,
  }
  const stats = linkStats(linkCatalog)
  const photos = new Map(catalog.photos.map((row) => [row.placeId, row.count]))
  const placeId = new Map(catalog.places.map((place) => [place.slug, place.id]))
  const publishedRoutes = new Set(catalog.routes.filter((route) => route.publicationStatus === 'published').map((route) => route.id))
  const publishedCollections = new Set(catalog.collections.filter((row) => row.publicationStatus === 'published').map((row) => row.id))
  const inRoute = new Set(catalog.routeStops.filter((stop) => publishedRoutes.has(stop.parentId)).map((stop) => stop.placeSlug))
  const inCollection = new Set(catalog.collectionStops.filter((stop) => publishedCollections.has(stop.parentId)).map((stop) => stop.placeSlug))
  const metricByPath = new Map(metrics.map((row) => [row.path, row]))
  const venuePhotos = new Map((catalog.venuePhotos ?? []).map((row) => [row.venueId, row.count]))

  function photosFor(slugs: string[]) {
    return slugs.reduce((sum, slug) => sum + (photos.get(placeId.get(slug) || '') ?? 0), 0)
  }

  function resultsFor(path: string, passport: PassportFields | null): ScoreSource['results'] {
    const metric = metricByPath.get(path)
    const search = searchTotalsForPath(path, queries, demandTargets(passport))
    return {
      ...emptyResults(),
      organic7d: metric?.organic7d ?? 0,
      organic30d: metric?.organic30d ?? 0,
      organic90d: metric?.organic90d ?? 0,
      searchImported,
      queries: search.queries,
      searchImpressions: search.impressions,
      searchClicks: search.clicks,
      pageviews30d: metric?.pageviews30d ?? 0,
      scrollMax: metric?.scrollEvents ? metric.scrollMax : null,
      avgEngagedSec: metric?.engageEvents ? (metric.avgEngagedMs ?? 0) / 1000 : null,
      engagedTracked: (metric?.engageEvents ?? 0) > 0,
      scrollTracked: (metric?.scrollEvents ?? 0) > 0,
      nextClicks: (metric?.outboundClicks ?? 0) + (metric?.continuations ?? 0),
    }
  }

  function stat(path: string) {
    return stats.get(path) ?? { inbound: 0, contentOutbound: 0, orphan: false }
  }

  const pages: ScoreSource[] = [
    ...catalog.places.map((place): ScoreSource => {
      const path = `/${place.slug}`
      const link = stat(path)
      const passport = passportOf(catalog, 'place', place.id)
      return {
        kind: 'place',
        id: place.id,
        path,
        title: place.title,
        summary: place.summary,
        body: place.body,
        howToGet: place.howToGet,
        hours: place.hours,
        price: place.price,
        categorySlug: place.categorySlug,
        categoryTitle: place.categoryTitle,
        schemaType: place.schemaType ?? null,
        regionTitle: place.regionTitle,
        latitude: place.latitude,
        longitude: place.longitude,
        sources: place.sources,
        faq: place.faq,
        publicationStatus: place.publicationStatus,
        noindex: place.noindex,
        seoTitle: place.seoTitle,
        seoDescription: place.seoDescription,
        factsCheckedAt: place.factsCheckedAt,
        factRefs: factRefs?.get(`place:${place.id}`),
        scheduleMode: place.scheduleMode ?? null,
        hoursKnown: catalogHoursKnown(place.schedule),
        firstPublishedAt: place.firstPublishedAt ?? null,
        photoCount: photos.get(place.id) ?? 0,
        inRoute: inRoute.has(place.slug),
        inCollection: inCollection.has(place.slug),
        memberCount: 0,
        inbound: link.inbound,
        contentOutbound: link.contentOutbound,
        orphan: link.orphan,
        passport,
        results: resultsFor(path, passport),
      }
    }),
    ...catalog.routes.map((route): ScoreSource => {
      const path = `/marshruty/${route.slug}`
      const link = stat(path)
      const passport = passportOf(catalog, 'route', route.id)
      const members = stopSlugs(catalog.routeStops, route.id, true)
      return {
        kind: 'route',
        id: route.id,
        path,
        title: route.title,
        summary: route.summary,
        body: route.body,
        howToGet: null,
        hours: null,
        price: null,
        categorySlug: null,
        categoryTitle: null,
        regionTitle: null,
        latitude: null,
        longitude: null,
        sources: [],
        publicationStatus: route.publicationStatus,
        noindex: route.noindex,
        seoTitle: route.seoTitle,
        seoDescription: route.seoDescription,
        factsCheckedAt: route.updatedAt,
        firstPublishedAt: route.firstPublishedAt ?? null,
        factRefs: factRefs?.get(`route:${route.id}`),
        photoCount: photosFor(members),
        inRoute: false,
        inCollection: false,
        memberCount: members.length,
        inbound: link.inbound,
        contentOutbound: link.contentOutbound,
        orphan: link.orphan,
        passport,
        results: resultsFor(path, passport),
      }
    }),
    ...catalog.collections.map((collection): ScoreSource => {
      const path = `/podborki/${collection.slug}`
      const link = stat(path)
      const passport = passportOf(catalog, 'collection', collection.id)
      const members = stopSlugs(catalog.collectionStops, collection.id, true)
      const stops = catalog.collectionStops
        .filter((stop) => stop.parentId === collection.id && stop.placePublished)
        .map((stop) => ({ city: stop.regionId, access: stop.access }))
      return {
        kind: 'collection',
        id: collection.id,
        path,
        title: collection.title,
        summary: collection.summary,
        body: collectionArticle(collection),
        howToGet: null,
        hours: null,
        price: null,
        categorySlug: null,
        categoryTitle: null,
        regionTitle: null,
        latitude: null,
        longitude: null,
        sources: [],
        publicationStatus: collection.publicationStatus,
        noindex: collection.noindex,
        seoTitle: collection.seoTitle,
        seoDescription: collection.seoDescription,
        factsCheckedAt: collection.updatedAt,
        firstPublishedAt: collection.firstPublishedAt ?? null,
        factRefs: factRefs?.get(`collection:${collection.id}`),
        photoCount: photosFor(members),
        inRoute: false,
        inCollection: false,
        memberCount: members.length,
        inbound: link.inbound,
        contentOutbound: link.contentOutbound,
        orphan: link.orphan,
        passport,
        results: resultsFor(path, passport),
        stops,
      }
    }),
    ...catalog.quests.map((quest): ScoreSource => {
      const path = `/kvesty/${quest.slug}`
      const link = stat(path)
      const passport = passportOf(catalog, 'quest', quest.id)
      const members = stopSlugs(catalog.questStops, quest.id, true)
      return {
        kind: 'quest',
        id: quest.id,
        path,
        title: quest.title,
        summary: quest.summary,
        body: quest.body,
        howToGet: null,
        hours: null,
        price: null,
        categorySlug: null,
        categoryTitle: null,
        regionTitle: null,
        latitude: null,
        longitude: null,
        sources: [],
        publicationStatus: quest.publicationStatus,
        noindex: quest.noindex,
        seoTitle: quest.seoTitle,
        seoDescription: quest.seoDescription,
        factsCheckedAt: quest.updatedAt,
        firstPublishedAt: quest.firstPublishedAt ?? null,
        factRefs: factRefs?.get(`quest:${quest.id}`),
        photoCount: photosFor(members),
        inRoute: false,
        inCollection: false,
        memberCount: members.length,
        inbound: link.inbound,
        contentOutbound: link.contentOutbound,
        orphan: link.orphan,
        passport,
        results: resultsFor(path, passport),
      }
    }),
    ...catalog.hubs.map((hub): ScoreSource => {
      const path = `/${hub.slug}`
      const link = stat(path)
      const passport = passportOf(catalog, 'hub', hub.id)
      const members = catalog.places.filter((place) => place.publicationStatus === 'published' && place.categorySlug === hub.slug).map((place) => place.slug)
      return {
        kind: 'hub',
        id: hub.id,
        path,
        title: hub.title,
        summary: hub.description,
        body: hub.body,
        howToGet: null,
        hours: null,
        price: null,
        categorySlug: hub.slug,
        categoryTitle: hub.title,
        regionTitle: null,
        latitude: null,
        longitude: null,
        sources: [],
        publicationStatus: 'published',
        noindex: hub.noindex,
        seoTitle: hub.seoTitle,
        seoDescription: hub.seoDescription,
        factsCheckedAt: hub.updatedAt,
        firstPublishedAt: hub.firstPublishedAt ?? null,
        factRefs: factRefs?.get(`hub:${hub.id}`),
        photoCount: photosFor(members),
        inRoute: false,
        inCollection: false,
        memberCount: members.length,
        inbound: link.inbound,
        contentOutbound: link.contentOutbound,
        orphan: link.orphan,
        passport,
        results: resultsFor(path, passport),
      }
    }),
    ...catalog.venues.map((venue): ScoreSource => {
      const path = `/zavedeniya/${venue.slug}`
      const link = stat(path)
      const passport = passportOf(catalog, 'venue', venue.id)
      return {
        kind: 'venue',
        id: venue.id,
        path,
        title: venue.name,
        summary: venue.description,
        body: venue.description,
        howToGet: null,
        hours: null,
        hoursKnown: catalogHoursKnown(venue.schedule),
        price: null,
        categorySlug: venue.kind,
        categoryTitle: null,
        regionTitle: venue.regionTitle,
        latitude: venue.latitude,
        longitude: venue.longitude,
        sources: [],
        publicationStatus: venue.publicationStatus,
        noindex: venue.noindex,
        seoTitle: venue.seoTitle,
        seoDescription: venue.seoDescription,
        factsCheckedAt: venue.factsCheckedAt,
        firstPublishedAt: venue.firstPublishedAt ?? null,
        factRefs: factRefs?.get(`venue:${venue.id}`),
        photoCount: venuePhotos.get(venue.id) ?? 0,
        inRoute: false,
        inCollection: false,
        memberCount: 0,
        inbound: link.inbound,
        contentOutbound: link.contentOutbound,
        orphan: link.orphan,
        passport,
        results: resultsFor(path, passport),
      }
    }),
  ]
  const include = new Set((options?.include ?? []).map((row) => `${row.kind}:${row.id}`))
  return pages
    .filter((page) => page.publicationStatus === 'published' || include.has(`${page.kind}:${page.id}`))
    .map((page) => scorePage(page, now))
}

export function toStored(score: PageScore): StoredScore {
  return {
    pageType: score.pageType,
    entityId: score.entityId,
    path: score.path,
    title: score.title,
    total: score.total,
    quality: score.quality,
    linking: score.linking,
    indexing: score.indexing,
    results: score.results,
    checks: score.checks,
    signals: score.signals,
    organic30d: score.organic30d,
    organic90d: score.organic90d,
    goal30d: score.goal30d,
    goal90d: score.goal90d,
  }
}
