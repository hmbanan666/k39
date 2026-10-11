const FILES: Record<string, string> = {
  forty: 'fort',
  fort: 'fort',
  zamki: 'castle',
  castle: 'castle',
  plyazhi: 'beach',
  beach: 'beach',
  kurorty: 'dunes',
  dunes: 'dunes',
  resort: 'dunes',
  muzei: 'museum',
  museum: 'museum',
  cathedral: 'cathedral',
  sobor: 'cathedral',
  eda: 'food',
  food: 'food',
}

// The cathedral shares the museum category. This one place uses the cathedral file.
const SLUGS: Record<string, string> = {
  'kafedralnyi-sobor': 'cathedral',
}

export const POSTMARK_SRC = '/illustrations/postmark.svg'

export function illustrationFor(kind?: string | null, slug?: string | null) {
  const fromSlug = slug ? SLUGS[slug] : undefined
  const file = FILES[fromSlug || kind || ''] || 'fort'
  return `/illustrations/${file}.svg`
}
