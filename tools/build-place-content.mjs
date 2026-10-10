/**
 * Build place markdown, the DB catalog snapshot, and (optionally) map JSON
 * from the forts prototype. UI strings inside generated markdown stay Russian.
 * This file is English on purpose.
 *
 * Usage:
 *   node tools/build-place-content.mjs
 *   node tools/build-place-content.mjs /path/to/forts-map
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'apps/web-app/app/data/forts')
const contentDir = path.join(root, 'apps/web-app/content/places')
const questDir = path.join(root, 'apps/web-app/content/quests')
const sharedDir = path.join(root, 'apps/web-app/shared/data')

const RU = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function translit(value) {
  return String(value)
    .toLowerCase()
    .split('')
    .map((char) => RU[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function clean(value) {
  if (value == null) {
    return value
  }
  return String(value)
    .replace(/[—–]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2011/g, '-')
}

const SLUG_OVERRIDES = {
  f1: 'fort-1-shtayn',
  f10: 'fort-10-kanitz',
}

function slugFor(object) {
  if (SLUG_OVERRIDES[object.id]) {
    return SLUG_OVERRIDES[object.id]
  }
  if (object.type === 'fort' && object.num) {
    return `fort-${String(object.num).toLowerCase()}-${translit(object.name)}`
  }
  return translit(object.name)
}

function canonicalStatus(object) {
  if (object.ruin) {
    return 'ruins'
  }
  if (['museum', 'open', 'tour', 'free'].includes(object.status)) {
    return 'open'
  }
  return 'unknown'
}

function yaml(value) {
  return JSON.stringify(value)
}

function loadPrototype(dir) {
  function run(file) {
    const context = { window: {} }
    vm.createContext(context)
    vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), context)
    return context.window
  }
  const objectsWindow = run('assets/objects.js')
  const geoWindow = run('assets/geo.js')
  return {
    objects: objectsWindow.K39_OBJECTS,
    quest: objectsWindow.K39_QUEST,
    geo: geoWindow.K39_GEO,
  }
}

function loadJson() {
  return {
    objects: JSON.parse(fs.readFileSync(path.join(dataDir, 'objects.json'), 'utf8')),
    quest: JSON.parse(fs.readFileSync(path.join(dataDir, 'quest.json'), 'utf8')),
    geo: null,
  }
}

const protoDir = process.argv[2]
const loaded = protoDir ? loadPrototype(protoDir) : loadJson()

const seen = new Set()
const objects = loaded.objects.map((object) => {
  let slug = object.slug || slugFor(object)
  if (seen.has(slug)) {
    slug = `${slug}-${object.id}`
  }
  seen.add(slug)
  return {
    ...object,
    slug,
    name: clean(object.name),
    de: clean(object.de),
    desc: clean(object.desc),
    how: clean(object.how),
    hours: clean(object.hours),
    hours_note: clean(object.hours_note),
    name_note: clean(object.name_note),
    status_text: clean(object.status_text),
  }
})

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(contentDir, { recursive: true })
fs.mkdirSync(questDir, { recursive: true })
fs.mkdirSync(sharedDir, { recursive: true })
for (const file of fs.readdirSync(contentDir)) {
  if (file.endsWith('.md')) {
    fs.unlinkSync(path.join(contentDir, file))
  }
}

if (loaded.geo) {
  fs.writeFileSync(path.join(dataDir, 'geo.json'), JSON.stringify(loaded.geo))
}

fs.writeFileSync(path.join(dataDir, 'objects.json'), `${JSON.stringify(objects, null, 2)}\n`)

const byId = Object.fromEntries(objects.map((object) => [object.id, object]))
const quest = {
  title: clean(loaded.quest.title),
  ids: loaded.quest.ids,
  note: clean(loaded.quest.note),
  slug: 'five-forts',
}
fs.writeFileSync(path.join(dataDir, 'quest.json'), `${JSON.stringify(quest, null, 2)}\n`)

const featured = new Set(['f11', 'f5', 'f1', 'cathedral'])

for (const object of objects) {
  const status = canonicalStatus(object)
  const lines = [
    '---',
    `title: ${yaml(object.type === 'fort' ? `Форт № ${object.num} «${object.name}»` : object.name)}`,
    `description: ${yaml(object.desc)}`,
    `slug: ${yaml(object.slug)}`,
    `placeType: ${yaml(object.type)}`,
    `status: ${yaml(status)}`,
    `statusLabel: ${yaml(object.status_text)}`,
    `lat: ${object.lat}`,
    `lon: ${object.lon}`,
  ]
  if (object.hours) {
    lines.push(`hours: ${yaml(object.hours)}`)
  }
  if (object.hours_note) {
    lines.push(`hoursNote: ${yaml(object.hours_note)}`)
  }
  if (object.name_note) {
    lines.push(`nameNote: ${yaml(object.name_note)}`)
  }
  if (object.de) {
    lines.push(`germanName: ${yaml(object.de)}`)
  }
  lines.push(
    `sourceName: ${yaml(object.src[0])}`,
    `sourceUrl: ${yaml(object.src[1])}`,
    `region: "kaliningrad"`,
    `mapId: ${yaml(object.id)}`,
    `how: ${yaml(object.how)}`,
    `featured: ${featured.has(object.id) ? 'true' : 'false'}`,
    '---',
    '',
    object.desc,
    '',
    '## Как добраться',
    '',
    object.how,
    '',
  )
  fs.writeFileSync(path.join(contentDir, `${object.slug}.md`), lines.join('\n'))
}

const steps = quest.ids.map((id) => {
  const object = byId[id]
  return {
    place: object.slug,
    title: `Форт № ${object.num} «${object.name}»`,
  }
})

const questBody = [
  '---',
  `title: ${yaml(quest.title)}`,
  `description: ${yaml(quest.note)}`,
  'slug: "five-forts"',
  'steps:',
  ...steps.flatMap((step) => [
    `  - place: ${yaml(step.place)}`,
    `    title: ${yaml(step.title)}`,
  ]),
  '---',
  '',
  quest.note,
  '',
  'Маршрут редакционный: форты, куда по опубликованным источникам можно попасть. Перед поездкой проверьте часы на странице каждого форта.',
  '',
  'Отметки «Я здесь» на карте хранятся только в этом браузере и не проверяют геолокацию.',
  '',
].join('\n')
fs.writeFileSync(path.join(questDir, 'five-forts.md'), questBody)

const catalog = {
  region: {
    slug: 'kaliningrad',
    title: 'Калининград',
    description: 'Городские форты, ворота и бастионы Кёнигсберга.',
  },
  places: objects.map((object) => ({
    slug: object.slug,
    title: object.type === 'fort' ? `Форт № ${object.num} «${object.name}»` : object.name,
    type: object.type,
    latitude: object.lat,
    longitude: object.lon,
    status: canonicalStatus(object),
    hours: object.hours ?? null,
    sourceUrl: object.src?.[1] ?? null,
    regionSlug: 'kaliningrad',
  })),
  route: {
    slug: 'five-forts',
    title: quest.title,
    summary: quest.note,
    regionSlug: 'kaliningrad',
    points: quest.ids.map((id) => byId[id].slug),
  },
  quest: {
    slug: 'five-forts',
    title: quest.title,
    summary: quest.note,
    routeSlug: 'five-forts',
    steps: quest.ids.map((id) => {
      const object = byId[id]
      return {
        placeSlug: object.slug,
        title: `Форт № ${object.num} «${object.name}»`,
        prompt: 'Отметьте визит на карте, когда будете на месте.',
      }
    }),
  },
}

fs.writeFileSync(path.join(sharedDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)
console.warn(`places ${objects.length}, quest steps ${quest.ids.length}`)
