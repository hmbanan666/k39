import { db } from '@k39/database'
import { homeLinks } from '../../shared/links'
import { renderMarkdown } from '../../shared/markdown'
import { absoluteUrl, collectionDocument, homeDocument, placeDocument } from '../../shared/seo'

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
  return {
    doc: homeDocument(),
    links: homeLinks(featured.map((place) => ({ href: `/${place.slug}`, text: place.title }))),
    featured: featured.map((place) => ({ href: `/${place.slug}`, text: place.title })),
  }
}

export async function loadHub(slug: string) {
  const category = await db.content.categoryBySlug(slug)
  if (!category) {
    return null
  }
  const rows = await db.content.publishedPlacesByCategory(category.id)
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
  })
  return {
    doc,
    html: renderMarkdown(category.description),
    places: rows.map((place) => ({ href: `/${place.slug}`, text: place.title })),
    routes: routes.map((route) => ({ href: `/marshruty/${route.slug}`, text: route.title })),
  }
}

export async function loadPlace(slug: string, page = 1) {
  const loaded = await db.content.publishedPlace(slug)
  if (!loaded?.category) {
    return null
  }
  const images = loaded.images.map(mediaImage)
  const listed = images[0]
    ? { url: images[0].url, width: images[0].width, height: images[0].height, alt: images[0].alt }
    : null
  const ogImage = loaded.place.ogImage
  const matched = ogImage
    ? images.find((image) => image.src === ogImage || image.url === absoluteUrl(ogImage))
    : undefined
  const image = ogImage
    ? {
        url: absoluteUrl(ogImage),
        width: matched?.width ?? null,
        height: matched?.height ?? null,
        alt: matched?.alt || loaded.place.title,
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
    seoTitle: loaded.place.seoTitle,
    seoDescription: loaded.place.seoDescription,
    noindex: loaded.place.noindex,
    sources: loaded.place.sources ?? [],
    image,
    page,
  })
  const groups = [
    { title: loaded.category.title, links: [{ href: `/${loaded.category.slug}`, text: loaded.category.title }] },
    { title: 'Рядом', links: loaded.nearest.slice(0, 5).map((item) => ({ href: `/${item.slug}`, text: item.title })) },
    loaded.region
      ? { title: `Ещё в регионе ${loaded.region.title}`, links: loaded.sameRegion.map((item) => ({ href: `/${item.slug}`, text: item.title })) }
      : null,
    { title: 'Маршруты', links: loaded.routeRows.map((item) => ({ href: `/marshruty/${item.slug}`, text: item.title })) },
    { title: 'Подборки', links: loaded.collectionRows.map((item) => ({ href: `/podborki/${item.slug}`, text: item.title })) },
    { title: 'Ещё по теме', links: loaded.related.map((item) => ({ href: `/${item.slug}`, text: item.anchor || item.title })) },
  ].flatMap((group) => (group && group.links.length ? [group] : []))
  const howToGet = loaded.place.howToGet?.trim()
  const body = howToGet && !loaded.place.body.includes(howToGet)
    ? `${loaded.place.body}\n\n## Как добраться\n\n${howToGet}`
    : loaded.place.body
  return {
    doc,
    html: renderMarkdown(body),
    place: loaded.place,
    category: loaded.category,
    region: loaded.region,
    images,
    groups,
    sources: loaded.place.sources ?? [],
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
  const doc = collectionDocument({
    path: `/marshruty/${loaded.route.slug}`,
    h1: loaded.route.title,
    summary: loaded.route.summary || loaded.route.title,
    crumbName: 'маршрут',
    parent: { name: 'Маршруты', href: '/marshruty' },
    items: loaded.points.map((point) => ({ name: point.title, url: `/${point.slug}` })),
    seoTitle: loaded.route.seoTitle,
    seoDescription: loaded.route.seoDescription,
    noindex: loaded.route.noindex,
    ogImage: storedImage(loaded.route.ogImage, loaded.route.title),
    kind: 'TouristTrip',
  })
  return {
    doc,
    html: renderMarkdown(loaded.route.body),
    items: loaded.points.map((point) => ({ href: `/${point.slug}`, text: point.title })),
  }
}

export async function loadCollectionIndex() {
  const rows = await db.content.listPublishedCollections()
  const doc = collectionDocument({
    path: '/podborki',
    h1: 'Подборки',
    summary: 'Подборки мест Калининградской области по теме.',
    crumbName: 'список',
    items: rows.map((row) => ({ name: row.title, url: `/podborki/${row.slug}` })),
    kind: 'CollectionPage',
  })
  return { doc, items: rows.map((row) => ({ href: `/podborki/${row.slug}`, text: row.title })) }
}

export async function loadCollection(slug: string) {
  const loaded = await db.content.publishedCollection(slug)
  if (!loaded) {
    return null
  }
  const doc = collectionDocument({
    path: `/podborki/${loaded.collection.slug}`,
    h1: loaded.collection.title,
    summary: loaded.collection.summary || loaded.collection.title,
    crumbName: 'подборка',
    parent: { name: 'Подборки', href: '/podborki' },
    items: loaded.items.map((item) => ({ name: item.title, url: `/${item.slug}` })),
    seoTitle: loaded.collection.seoTitle,
    seoDescription: loaded.collection.seoDescription,
    noindex: loaded.collection.noindex,
    ogImage: storedImage(loaded.collection.ogImage, loaded.collection.title),
    kind: 'CollectionPage',
  })
  return {
    doc,
    html: renderMarkdown(loaded.collection.body),
    items: loaded.items.map((item) => ({ href: `/${item.slug}`, text: item.title })),
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
  })
  return {
    doc,
    html: renderMarkdown(loaded.quest.body),
    items: loaded.steps.map((step) => ({ href: `/${step.slug}`, text: step.title })),
  }
}
