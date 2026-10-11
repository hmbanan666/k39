import type { MediaLicense, MediaVariant } from '@k39/database'

export type { MediaLicense, MediaVariant }

export interface PublicMedia {
  id: string
  alt: string
  caption: string | null
  author: string | null
  license: MediaLicense | null
  sourceUrl: string | null
  width: number | null
  height: number | null
  focalX: number
  focalY: number
  dominantColor: string | null
  lqip: string | null
  src: string
  variants: MediaVariant[]
}

export interface MediaRowLike {
  id: string
  filename: string
  alt: string
  caption?: string | null
  author?: string | null
  credit?: string | null
  license?: MediaLicense | null
  sourceUrl?: string | null
  width: number | null
  height: number | null
  focalX?: number | null
  focalY?: number | null
  dominantColor?: string | null
  lqip?: string | null
  variants?: MediaVariant[] | null
}

const LICENSE_LINKS: Record<string, string> = {
  'cc-by': 'https://creativecommons.org/licenses/by/4.0/deed.ru',
  'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru',
  'cc0': 'https://creativecommons.org/publicdomain/zero/1.0/deed.ru',
}

const LICENSE_LABELS: Record<string, string> = {
  'own': 'фото K39',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  'cc0': 'CC0',
  'pd': 'общественное достояние',
  'permission': 'с разрешения автора',
}

export function licenseLabel(license: string | null | undefined) {
  if (!license) {
    return ''
  }
  return LICENSE_LABELS[license] || license
}

export function licenseHref(license: string | null | undefined) {
  if (!license) {
    return ''
  }
  return LICENSE_LINKS[license] || ''
}

export function toPublicMedia(row: MediaRowLike): PublicMedia {
  const variants = row.variants ?? []
  const webp = variants
    .filter((item) => item.format === 'webp')
    .sort((a, b) => b.width - a.width)[0]
  const src = variants.length && webp
    ? `/media/${row.id}/${webp.file}`
    : `/media/${row.filename}`
  return {
    id: row.id,
    alt: row.alt,
    caption: row.caption ?? null,
    author: row.author || row.credit || null,
    license: row.license ?? null,
    sourceUrl: row.sourceUrl ?? null,
    width: row.width,
    height: row.height,
    focalX: row.focalX ?? 0.5,
    focalY: row.focalY ?? 0.5,
    dominantColor: row.dominantColor ?? null,
    lqip: row.lqip ?? null,
    src,
    variants,
  }
}

export function ogPath(media: PublicMedia) {
  if (media.variants.some((item) => item.file === 'og.jpg')) {
    return `/media/${media.id}/og.jpg`
  }
  return media.src
}
