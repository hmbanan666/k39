import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

async function main() {
  const root = process.cwd()
  const server = await createServer({ configFile: false, root, server: { middlewareMode: true } })
  try {
    const load = (path) => server.ssrLoadModule(resolve(root, path))
    const { writingHits } = await load('apps/web-app/shared/writing.ts')
    const { statusChecks } = await load('apps/web-app/shared/status-consistency.ts')
    const { closureText } = await load('apps/web-app/shared/schedule.ts')
    const { routeStopViews } = await load('apps/web-app/shared/route-nav.ts')
    const { toPublicVenueModules } = await load('apps/web-app/shared/venue-modules.ts')
    const { osmElementToDraft } = await load('packages/database/src/venues.ts')
    const pronouns = ['Что посмотреть в самом Нестерове?', 'У самого моря.', 'К самому берегу.'].map((text) => ({ text, hits: writingHits(text) }))
    assert(pronouns.every((row) => row.hits.some((hit) => hit.phrase === 'empty superlatives')))
    const appointment = statusChecks({ title: 'Полесск', text: 'Пивоварня принимает по предварительной записи.', mode: 'always' })
    assert(appointment.contradictions.some((text) => text.includes('by appointment')))
    const closure = closureText({ reason: 'other', viewableOutside: true })
    assert.match(closure, /Временно/)
    const legs = routeStopViews([
      { href: '/fixture-a', text: 'А', latitude: 54.7, longitude: 20.5 },
      { href: '/fixture-b', text: 'Б', latitude: 54.704, longitude: 20.5 },
      { href: '/fixture-c', text: 'В', latitude: 54.9, longitude: 20.5 },
    ]).map((row) => row.distanceLabel)
    assert.match(legs[0], /450 м/)
    assert.match(legs[1], /км/)
    assert(legs.filter(Boolean).every((text) => !text.includes('по прямой')))
    const price = { priceRub: 100, sourceUrl: 'https://example.com/menu', sourceTitle: 'Фикстура' }
    const hiddenPrices = toPublicVenueModules([], (text) => text, [price])
    assert.equal(hiddenPrices, null)
    const imported = osmElementToDraft({ type: 'node', id: 1, lat: 54.7, lon: 20.5, tags: { 'amenity': 'cafe', 'name': 'Фикстура', 'contact:phone': '+7 000 000 00 00' } })
    assert.equal(imported.phone, '+7 000 000 00 00')
    const report = {
      baseline: 'cf06c4fcb1c52d806a330c271c34460868de31b6',
      boundary: 'Isolated synthetic inputs; no production writes or external source verification',
      pronouns, appointment, closure, legs, hiddenPrices,
      importedPhone: { phone: imported.phone, sources: imported.sources },
    }
    await writeFile(resolve(root, 'docs/reviews/2026-10-23-issue-triage/probe.json'), `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write('Six issue mechanisms reproduced; a short route leg is present with valid coordinates.\n')
  } finally {
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
