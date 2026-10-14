import { bodyOf, db } from '@k39/database'
import { collectionPlaceCards } from '../../shared/collection-page'
import { homeLinks, HUBS } from '../../shared/links'
import { normalizeRoutePath } from '../../shared/map'
import { renderMarkdown } from '../../shared/markdown'
import { describedAlt, toPublicMedia } from '../../shared/media'
import { monthName, splitCollections } from '../../shared/month-guide'
import { categoryTags, toPublicModules } from '../../shared/page-modules'
import { questRoutePath, questStepCards } from '../../shared/quest-page'
import { routeStopViews } from '../../shared/route-nav'
import { absoluteUrl, collectionDocument, homeDocument, isoDay, placeDocument, socialImage, splitDirections, stripRepeatedLead } from '../../shared/seo'
import { loadSchedule } from './schedule'
import { eatNearby } from './venues/public'

function mediaImage(file: { filename: string, alt: string, width: number | null, height: number | null }) {
  return {
    src: `/media/${file.filename}`,
    url: absoluteUrl(`/media/${file.filename}`),
    alt: file.alt,
    width: file.width,
    height: file.height,
  }
}

function storedImage(path: string | null | undefined, alt: string) {
  const value = path?.trim()
  if (!value) {
    return undefined
  }
  return {
    url: absoluteUrl(value),
    width: null,
    height: null,
    alt,
  }
}

export async function loadHome() {
  const cats = await db.content.categories()
  const forty = cats.find((item) => item.slug === 'forty')
  const featured = forty ? (await db.content.publishedPlacesByCategory(forty.id)).slice(0, 6) : []
  const featuredCovers = await db.content.coversFor(featured.map((place) => place.id))
  const photoRow = featured.map((place) => featuredCovers.get(place.id)).find((row) => row)
  const routes = await db.content.listPublishedRoutes()
  const firstRoute = routes[0] ? await db.content.publishedRoute(routes[0].slug) : null
  const quests = await db.content.listPublishedQuests()
  const quest = quests[0]
  return {
    doc: homeDocument(),
    links: homeLinks(featured.map((place) => ({ href: `/${place.slug}`, text: place.title }))),
    hubs: HUBS.map((link) => {
      const category = cats.find((item) => `/${item.slug}` === link.href)
      return {
        href: link.href,
        title: link.text,
        summary: category?.description || '',
      }
    }),
    featured: featured.map((place) => ({
      href: `/${place.slug}`,
      title: place.title,
      summary: place.summary,
      hub: 'Форты',
      hubHref: '/forty',
    })),
    route: firstRoute
      ? {
          href: `/marshruty/${firstRoute.route.slug}`,
          title: firstRoute.route.title,
          summary: firstRoute.route.summary || '',
          steps: firstRoute.points.map((point) => ({ href: `/${point.slug}`, text: point.title, note: point.note })),
        }
      : null,
    quest: quest
      ? {
          href: `/kvesty/${quest.slug}`,
          title: quest.title,
          summary: quest.summary || '',
        }
      : null,
    photo: photoRow ? toPublicMedia(photoRow) : null,
  }
}

export async function loadHub(slug: string) {
  const category = await db.content.categoryBySlug(slug)
  if (!category) {
    return null
  }
  const rows = await db.content.publishedPlacesByCategory(category.id)
  const covers = await db.content.coversFor(rows.map((place) => place.id))
  const routes = slug === 'forty' ? await db.content.listPublishedRoutes() : []
  const doc = collectionDocument({
    path: `/${category.slug}`,
    h1: category.title,
    summary: category.description,
    crumbName: 'раздел',
    items: rows.map((place) => ({ name: place.title, url: `/${place.slug}` })),
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    noindex: category.noindex,
    ogImage: storedImage(category.ogImage, category.title),
    kind: 'CollectionPage',
    body: category.body,
  })
  const article = category.body.trim()
  return {
    doc,
    html: renderMarkdown(category.description),
    bodyHtml: article ? renderMarkdown(article) : '',
    places: rows.map((place) => {
      const cover = covers.get(place.id)
      return {
        href: `/${place.slug}`,
        title: place.title,
        summary: place.summary,
        hub: category.title,
        hubHref: `/${category.slug}`,
        kind: category.slug,
        media: cover ? toPublicMedia(cover) : null,
        image: cover
          ? mediaImage({ filename: cover.filename, alt: cover.alt, width: cover.width, height: cover.height })
          : null,
      }
    }),
    routes: routes.map((route) => ({ href: `/marshruty/${route.slug}`, text: route.title })),
  }
}

export async function loadPlace(slug: string, page = 1) {
  const loaded = await db.content.publishedPlace(slug)
  if (!loaded?.category) {
    return null
  }
  const schedule = await loadSchedule('place', loaded.place.id)
  const gallery = loaded.gallery.map((item) => ({ ...toPublicMedia(item.media), isCover: item.isCover }))
  const cover = gallery.find((item) => item.isCover) ?? gallery[0] ?? null
  const images = gallery.map((item) => {
    const social = socialImage(item, item.alt)
    return {
      src: item.src,
      url: social.url,
      alt: item.alt,
      width: social.width,
      height: social.height,
    }
  })
  const listed = cover ? socialImage(cover, cover.alt || loaded.place.title) : null
  const ogImage = loaded.place.ogImage
  const image = ogImage
    ? {
        url: absoluteUrl(ogImage),
        width: listed?.width ?? null,
        height: listed?.height ?? null,
        alt: listed?.alt || loaded.place.title,
        type: listed?.type,
      }
    : listed
  const doc = placeDocument({
    slug: loaded.place.slug,
    title: loaded.place.title,
    summary: loaded.place.summary,
    categorySlug: loaded.category.slug,
    categoryTitle: loaded.category.title,
    regionTitle: loaded.region?.title ?? null,
    latitude: loaded.place.latitude,
    longitude: loaded.place.longitude,
    hours: loaded.place.hours,
    schedule,
    price: loaded.place.price,
    seoTitle: loaded.place.seoTitle,
    seoDescription: loaded.place.seoDescription,
    noindex: loaded.place.noindex,
    sources: loaded.place.sources ?? [],
    image,
    images: gallery.map((item) => {
      const social = socialImage(item, describedAlt(item.alt || loaded.place.title, item.author, item.license))
      return {
        url: social.url,
        width: social.width,
        height: social.height,
        alt: social.alt,
        author: item.author,
        license: item.license,
        sourceUrl: item.sourceUrl,
      }
    }),
    page,
    body: bodyOf(loaded.place),
    faq: loaded.place.faq ?? [],
    updatedAt: loaded.place.updatedAt,
    checkedAt: loaded.place.lastVerifiedAt,
  })
  const nearCovers = await db.content.coversFor(loaded.nearest.map((item) => item.place_id))
  const groups = [
    { title: loaded.category.title, links: [{ href: `/${loaded.category.slug}`, text: loaded.category.title }] },
    { title: 'Рядом', links: loaded.nearest.slice(0, 6).map((item) => ({
      href: `/${item.slug}`,
      text: item.title,
      distanceKm: Number(item.distance_km),
      kind: item.category_slug,
      media: nearCovers.get(item.place_id) ? toPublicMedia(nearCovers.get(item.place_id)!) : null,
    })) },
    loaded.region
      ? { title: `Ещё в регионе ${loaded.region.title}`, links: loaded.sameRegion.map((item) => ({ href: `/${item.slug}`, text: item.title })) }
      : null,
    { title: 'Маршруты', links: loaded.routeRows.map((item) => ({ href: `/marshruty/${item.slug}`, text: item.title })) },
    { title: 'Подборки', links: loaded.collectionRows.map((item) => ({ href: `/podborki/${item.slug}`, text: item.title })) },
    { title: 'Ещё по теме', links: loaded.related.map((item) => ({ href: `/${item.slug}`, text: item.anchor || item.title })) },
  ].flatMap((group) => (group && group.links.length ? [group] : []))
  const primary = loaded.routeRows[0] ? await db.content.publishedRoute(loaded.routeRows[0].slug) : null
  const stepIndex = primary ? primary.points.findIndex((point) => point.slug === loaded.place.slug) : -1
  const nextStep = primary && stepIndex >= 0 ? primary.points[stepIndex + 1] : undefined
  const routeBand = primary
    ? {
        href: `/marshruty/${primary.route.slug}`,
        title: primary.route.title,
        summary: primary.route.summary || '',
        steps: primary.points.map((point) => ({
          href: `/${point.slug}`,
          text: point.title,
          note: point.note,
          current: point.slug === loaded.place.slug,
        })),
        next: nextStep ? { href: `/${nextStep.slug}`, text: nextStep.title } : null,
      }
    : null
  const structuredFaq = (loaded.place.faq ?? []).filter((item) => item.question.trim() && item.answer.trim())
  // The template renders «Как добраться» as its own block. A body section with that heading
  // moves into the block, so the page never shows it twice.
  const split = splitDirections(stripRepeatedLead(loaded.place.summary, bodyOf(loaded.place)))
  const body = split.article
  const directionsSource = split.directions || loaded.place.howToGet?.trim() || ''
  return {
    doc,
    html: renderMarkdown(body),
    directionsHtml: directionsSource ? renderMarkdown(directionsSource, { headingPrefix: 'directions-' }) : '',
    faq: structuredFaq,
    checkedAt: isoDay(loaded.place.lastVerifiedAt),
    place: { ...loaded.place, schedule },
    categoryTitle: loaded.category.title,
    categorySlug: loaded.category.slug,
    category: loaded.category,
    offers: await db.content.activeOffers(loaded.place.id),
    region: loaded.region,
    images,
    gallery,
    cover,
    groups,
    routeBand,
    sources: loaded.place.sources ?? [],
    eatNearby: await eatNearby([{ latitude: loaded.place.latitude, longitude: loaded.place.longitude }]),
  }
}

export async function loadRouteIndex() {
  const rows = await db.content.listPublishedRoutes()
  const doc = collectionDocument({
    path: '/marshruty',
    h1: 'Маршруты',
    summary: 'Маршруты по местам Калининградской области с порядком остановок.',
    crumbName: 'список',
    items: rows.map((row) => ({ name: row.title, url: `/marshruty/${row.slug}` })),
    kind: 'CollectionPage',
  })
  return { doc, items: rows.map((row) => ({ href: `/marshruty/${row.slug}`, text: row.title })) }
}

export async function loadRoute(slug: string) {
  const loaded = await db.content.publishedRoute(slug)
  if (!loaded) {
    return null
  }
  const stops = routeStopViews(loaded.points.map((point) => ({
    href: `/${point.slug}`,
    text: point.title,
    note: point.note,
    latitude: point.latitude,
    longitude: point.longitude,
  })))
  const doc = collectionDocument({
    path: `/marshruty/${loaded.route.slug}`,
    h1: loaded.route.title,
    summary: loaded.route.summary || loaded.route.title,
    crumbName: 'маршрут',
    parent: { name: 'Маршруты', href: '/marshruty' },
    items: loaded.points.map((point) => ({
      name: point.title,
      url: `/${point.slug}`,
      note: point.note,
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    seoTitle: loaded.route.seoTitle,
    seoDescription: loaded.route.seoDescription,
    noindex: loaded.route.noindex,
    ogImage: storedImage(loaded.route.ogImage, loaded.route.title),
    kind: 'TouristTrip',
    body: bodyOf(loaded.route),
  })
  return {
    doc,
    html: renderMarkdown(bodyOf(loaded.route)),
    summary: loaded.route.summary || '',
    path: normalizeRoutePath(loaded.route.path),
    stops,
    items: stops.map((stop) => ({ href: stop.href, text: stop.text, note: stop.note })),
    eatNearby: await eatNearby(loaded.points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    }))),
  }
}

export async function loadCollectionIndex() {
  const rows = await db.content.listPublishedCollections()
  const { months, themes } = splitCollections(rows)
  const ordered = [...months, ...themes]
  const doc = collectionDocument({
    path: '/podborki',
    h1: 'Подборки',
    summary: 'Подборки мест Калининградской области по теме и путеводители по месяцам.',
    crumbName: 'список',
    items: ordered.map((row) => ({ name: row.title, url: `/podborki/${row.slug}` })),
    kind: 'CollectionPage',
  })
  const link = (row: { slug: string, title: string }) => ({ href: `/podborki/${row.slug}`, text: row.title })
  return { doc, items: themes.map(link), months: months.map(link) }
}

export async function loadCollection(slug: string) {
  const loaded = await db.content.publishedCollection(slug)
  if (!loaded) {
    return null
  }
  const isMonth = loaded.collection.kind === 'month'
  const gallery = (await db.content.collectionGallery(loaded.collection.id)).map((item) => ({ ...toPublicMedia(item.media), isCover: item.isCover }))
  const cover = gallery.find((item) => item.isCover) ?? gallery[0] ?? null
  const coverImage = cover ? socialImage(cover, cover.alt || loaded.collection.title) : undefined
  const doc = collectionDocument({
    path: `/podborki/${loaded.collection.slug}`,
    h1: loaded.collection.title,
    summary: loaded.collection.summary || loaded.collection.title,
    crumbName: isMonth ? 'путеводитель' : 'подборка',
    parent: { name: 'Подборки', href: '/podborki' },
    items: loaded.items.map((item) => ({ name: item.title, url: `/${item.slug}`, note: item.note })),
    seoTitle: loaded.collection.seoTitle,
    seoDescription: loaded.collection.seoDescription,
    noindex: loaded.collection.noindex,
    ogImage: storedImage(loaded.collection.ogImage, loaded.collection.title) ?? coverImage,
    images: gallery.map((item) => {
      const social = socialImage(item, describedAlt(item.alt || loaded.collection.title, item.author, item.license))
      return {
        url: social.url,
        width: social.width,
        height: social.height,
        alt: social.alt,
        author: item.author,
        license: item.license,
        sourceUrl: item.sourceUrl,
      }
    }),
    kind: 'CollectionPage',
    body: loaded.collection.body,
  })
  const monthRows = isMonth ? splitCollections(await db.content.listPublishedCollections()).months : []
  const months = monthRows.filter((row) => row.slug !== loaded.collection.slug).map((row) => ({ href: `/podborki/${row.slug}`, text: row.title }))
  const monthNav = monthRows.map((row) => ({ href: `/podborki/${row.slug}`, text: monthName(row.month), current: row.slug === loaded.collection.slug }))
  const covers = await db.content.coversFor(loaded.items.map((item) => item.id))
  const places = collectionPlaceCards(loaded.items).map((card, index) => {
    const source = loaded.items[index]
    const cover = source ? covers.get(source.id) : undefined
    return { ...card, tags: categoryTags(card.kind), media: cover ? toPublicMedia(cover) : null }
  })
  const stored = loaded.collection.modules ?? []
  const modules = stored.length ? toPublicModules(stored, (markdown) => renderMarkdown(markdown)) : null
  return {
    doc,
    modules: modules ?? [],
    html: modules?.length ? '' : renderMarkdown(loaded.collection.body),
    places,
    kind: loaded.collection.kind,
    sources: loaded.collection.sources ?? [],
    months,
    monthNav,
    cover,
    gallery,
  }
}

export async function loadQuestIndex() {
  const rows = await db.content.listPublishedQuests()
  const doc = collectionDocument({
    path: '/kvesty',
    h1: 'Квесты',
    summary: 'Квесты по местам Калининградской области: точки и порядок.',
    crumbName: 'список',
    items: rows.map((row) => ({ name: row.title, url: `/kvesty/${row.slug}` })),
    kind: 'CollectionPage',
  })
  return { doc, items: rows.map((row) => ({ href: `/kvesty/${row.slug}`, text: row.title })) }
}

export async function loadQuest(slug: string) {
  const loaded = await db.content.publishedQuest(slug)
  if (!loaded) {
    return null
  }
  const covers = await db.content.coversFor(loaded.steps.map((step) => step.placeId))
  const doc = collectionDocument({
    path: `/kvesty/${loaded.quest.slug}`,
    h1: loaded.quest.title,
    summary: loaded.quest.summary || loaded.quest.title,
    crumbName: 'квест',
    parent: { name: 'Квесты', href: '/kvesty' },
    items: loaded.steps.map((step) => ({ name: step.title, url: `/${step.slug}` })),
    seoTitle: loaded.quest.seoTitle,
    seoDescription: loaded.quest.seoDescription,
    noindex: loaded.quest.noindex,
    ogImage: storedImage(loaded.quest.ogImage, loaded.quest.title),
    kind: 'TouristTrip',
    body: loaded.quest.body,
  })
  return {
    doc,
    html: renderMarkdown(loaded.quest.body),
    route: loaded.route
      ? { slug: loaded.route.slug, title: loaded.route.title, href: questRoutePath(loaded.route.slug) }
      : null,
    steps: questStepCards(loaded.steps).map((step, index) => {
      const source = loaded.steps[index]
      const cover = source ? covers.get(source.placeId) : undefined
      return { ...step, media: cover ? toPublicMedia(cover) : null }
    }),
  }
}
