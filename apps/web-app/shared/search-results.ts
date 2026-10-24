import type { RegionDisplay } from './region'
import { regionLabel } from './region'

export interface SearchHit {
  kind: 'place' | 'route' | 'collection' | 'quest' | 'venue' | 'hub' | 'city'
  path: string
  title: string
  label: string
  region: string
  snippet: string
}

/** Presentation only: keep the view's membership, rank, paths and wire kinds. */
export function areaSearchResults<T extends SearchHit>(results: T[], regions: RegionDisplay[]): T[] {
  return results.map((hit) => {
    if (hit.kind === 'city') {
      const region = regions.find((row) => hit.path === `/gde-poest-seychas/${row.slug}`)
      return { ...hit, title: regionLabel(region ?? { title: hit.title }), label: 'Территория каталога' }
    }
    const matches = regions.filter((row) => hit.region === row.shortTitle || hit.region === row.title)
    const region = matches.length === 1 ? matches[0] : undefined
    return { ...hit, region: hit.region ? regionLabel(region ?? { title: hit.region }) : '' }
  })
}
