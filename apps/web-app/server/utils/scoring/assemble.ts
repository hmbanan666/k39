import type { CatalogStop, ContentCatalog, PageMetric, StoredScore } from '@k39/database'
import type { LinkCatalog, PageKind, PageScore, PassportFields, ScoreSource } from '../../../shared/scoring'
import { emptyResults, linkStats, queriesForPath, scorePage } from '../../../shared/scoring'

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
  }
}

export function scoresFromCatalog(
  catalog: ContentCatalog,
  metrics: PageMetric[],
  queries: Array<{ page: string, query: string }>,
  searchImported: boolean,
  now = new Date(),
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
      body: collection.body,
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
      noindex: hub.noindex,
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

  function photosFor(slugs: string[]) {
    return slugs.reduce((sum, slug) => sum + (photos.get(placeId.get(slug) || '') ?? 0), 0)
  }

  function resultsFor(path: string, passport: PassportFields | null): ScoreSource['results'] {
    const metric = metricByPath.get(path)
    return {
      ...emptyResults(),
      organic7d: metric?.organic7d ?? 0,
      organic30d: metric?.organic30d ?? 0,
      organic90d: metric?.organic90d ?? 0,
      searchImported,
      queries: queriesForPath(path, queries, passport?.targetQueries ?? []),
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
        regionTitle: place.regionTitle,
        latitude: place.latitude,
        longitude: place.longitude,
        sources: place.sources,
        publicationStatus: place.publicationStatus,
        noindex: place.noindex,
        seoTitle: place.seoTitle,
        seoDescription: place.seoDescription,
        factsCheckedAt: place.factsCheckedAt,
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
      return {
        kind: 'collection',
        id: collection.id,
        path,
        title: collection.title,
        summary: collection.summary,
        body: collection.body,
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
        body: hub.description,
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
  ]
  return pages.map((page) => scorePage(page, now))
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
