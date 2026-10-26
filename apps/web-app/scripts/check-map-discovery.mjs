import assert from 'node:assert/strict'
import process from 'node:process'

// Check the built server's output, including the sitemap module's final filter.
async function main() {
  const base = process.argv[2] || 'http://127.0.0.1:3456'
  async function body(path) {
    const response = await fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(15_000) })
    assert.equal(response.status, 200, path)
    return response.text()
  }
  function attr(tag, name) {
    return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`))?.[1]
  }
  const title = 'Карта Калининградской области | K39'
  for (const query of [
    '',
    '?c=sights',
    '?s=forty',
    '?f=kofe',
    '?r=five-forts',
    '?q=fort',
    '?focus=fort-11-denhoff',
    '?utm_source=smoke',
  ]) {
    const html = await body(`/map${query}`)
    assert.equal(html.match(/<title>([^<]*)<\/title>/)?.[1], title, `title ${query}`)
    const canonical = (html.match(/<link\b[^>]*>/g) || []).find((tag) => attr(tag, 'rel') === 'canonical')
    assert.equal(attr(canonical || '', 'href'), 'https://k39.online/map', `canonical ${query}`)
    const robots = (html.match(/<meta\b[^>]*>/g) || []).find((tag) => attr(tag, 'name') === 'robots')
    assert(robots, `robots ${query}`)
    assert.equal(
      attr(robots, 'content').includes('noindex'),
      Boolean(query && !query.startsWith('?utm_')),
      `robots ${query}`,
    )
  }
  const home = await body('/')
  const footer = home.match(/<footer\b[\s\S]*?<\/footer>/)?.[0] || ''
  assert.equal((footer.match(/href="\/map"/g) || []).length, 1, 'one footer map link')
  const xml = await body('/sitemap.xml')
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim())
  assert.equal(locations.filter((loc) => loc === 'https://k39.online/map').length, 1, 'clean map in final sitemap XML')
  assert.equal(
    locations.filter((loc) => /^https:\/\/k39\.online\/map[/?]/.test(loc)).length,
    0,
    'no filtered/child map URLs',
  )
  process.stdout.write('Map discovery: title, canonical, robots, footer and final sitemap XML passed.\n')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
