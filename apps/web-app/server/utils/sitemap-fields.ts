export function sitemapLastmod(value: string | null | undefined) {
  if (!value) {
    return undefined
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T').replace(/\+00$/, 'Z')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }
  return date.toISOString()
}

export function latestSitemapLastmod(values: Array<string | null | undefined>) {
  return values
    .map((value) => sitemapLastmod(value))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
}
