import { inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { slugRedirects } from '../../tables'
import { Content } from '../content'

const PATHS = [
  '/hotpath-hit',
  '/hotpath-a',
  '/hotpath-b',
  '/hotpath-c',
  '/hotpath-loop-a',
  '/hotpath-loop-b',
  '/hotpath-gone',
  '/hotpath-gone-next',
  ...Array.from({ length: 12 }, (_, index) => `/hotpath-h${index}`),
  ...Array.from({ length: 20 }, (_, index) => `/hotpath-noise-${index}`),
]

async function clearHotpathRedirects() {
  await useDatabase().delete(slugRedirects).where(inArray(slugRedirects.fromPath, PATHS))
}

describe('slug redirect lookup', () => {
  afterEach(async () => {
    await clearHotpathRedirects()
  })

  it('reads one path, a chain, a loop, and a 410 without the rest of the table', async () => {
    await clearHotpathRedirects()
    const db = useDatabase()
    await db.insert(slugRedirects).values([
      { fromPath: '/hotpath-hit', toPath: '/hotpath-dest', statusCode: 301 },
      { fromPath: '/hotpath-a', toPath: '/hotpath-b', statusCode: 301 },
      { fromPath: '/hotpath-b', toPath: '/hotpath-c', statusCode: 301 },
      { fromPath: '/hotpath-loop-a', toPath: '/hotpath-loop-b', statusCode: 301 },
      { fromPath: '/hotpath-loop-b', toPath: '/hotpath-loop-a', statusCode: 301 },
      { fromPath: '/hotpath-gone', toPath: '/hotpath-gone-next', statusCode: 410 },
      { fromPath: '/hotpath-gone-next', toPath: '/hotpath-after', statusCode: 301 },
      ...Array.from({ length: 12 }, (_, index) => ({
        fromPath: `/hotpath-h${index}`,
        toPath: `/hotpath-h${index + 1}`,
        statusCode: 301,
      })),
      ...Array.from({ length: 20 }, (_, index) => ({
        fromPath: `/hotpath-noise-${index}`,
        toPath: '/hotpath-elsewhere',
        statusCode: 301,
      })),
    ])

    expect(await Content.redirectChain('/hotpath-missing')).toEqual([])

    expect(await Content.redirectChain('/hotpath-hit')).toEqual([
      { fromPath: '/hotpath-hit', toPath: '/hotpath-dest', statusCode: 301 },
    ])

    expect(await Content.redirectChain('/hotpath-a')).toEqual([
      { fromPath: '/hotpath-a', toPath: '/hotpath-b', statusCode: 301 },
      { fromPath: '/hotpath-b', toPath: '/hotpath-c', statusCode: 301 },
    ])

    const loop = await Content.redirectChain('/hotpath-loop-a')
    expect(loop.map((row) => row.fromPath)).toEqual(['/hotpath-loop-a', '/hotpath-loop-b'])

    expect(await Content.redirectChain('/hotpath-gone')).toEqual([
      { fromPath: '/hotpath-gone', toPath: '/hotpath-gone-next', statusCode: 410 },
    ])

    const capped = await Content.redirectChain('/hotpath-h0')
    expect(capped).toHaveLength(10)
    expect(capped[0]?.fromPath).toBe('/hotpath-h0')
    expect(capped[9]?.toPath).toBe('/hotpath-h10')
    expect(capped.some((row) => row.fromPath === '/hotpath-h10')).toBe(false)
    expect(capped.some((row) => row.fromPath.startsWith('/hotpath-noise'))).toBe(false)
  })
})
