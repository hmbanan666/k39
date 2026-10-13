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
  'cc-by': 'CC BY 4.0',
  'cc-by-sa': 'CC BY-SA 4.0',
  'cc0': 'CC0 1.0',
  'pd': 'общественное достояние',
  'permission': 'с разрешения автора',
}

export interface AuthorBadgeData {
  type: 'external' | 'user'
  name: string
  avatarUrl?: string | null
  profileUrl?: string | null
  license?: string | null
  sourceUrl?: string | null
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

export function describedAlt(alt: string, author?: string | null, license?: string | null) {
  return [alt.trim(), author?.trim(), licenseLabel(license)].filter(Boolean).join('. ')
}

export function authorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((part) => part[0] ?? '').join('')
  return letters.toLocaleUpperCase('ru') || '?'
}

export function authorFromMedia(media: Pick<PublicMedia, 'author' | 'license' | 'sourceUrl'>): AuthorBadgeData {
  return {
    type: 'external',
    name: media.author?.trim() || 'Автор неизвестен',
    avatarUrl: null,
    profileUrl: null,
    license: media.license,
    sourceUrl: media.sourceUrl,
  }
}

export function largestVariantUrl(media: Pick<PublicMedia, 'id' | 'src' | 'variants'>, format: 'avif' | 'webp') {
  const best = media.variants
    .filter((item) => item.format === format)
    .reduce<PublicMedia['variants'][number] | null>((winner, item) => {
      if (!winner || item.width > winner.width) {
        return item
      }
      return winner
    }, null)
  return best ? `/media/${media.id}/${best.file}` : ''
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
  return openGraphFile(media).path
}

export function variantSrcset(media: Pick<PublicMedia, 'id' | 'variants'>, format: 'avif' | 'webp') {
  const items = media.variants
    .filter((item) => item.format === format && item.file !== 'og.jpg' && item.width > 0)
    .sort((a, b) => a.width - b.width)
  if (!items.length) {
    return ''
  }
  return items.map((item) => `/media/${media.id}/${item.file} ${item.width}w`).join(', ')
}

// Social cards use the cropped og.jpg when the pipeline stored one.
// Width and height are that file's, so the meta tags match the bytes.
export function openGraphFile(media: Pick<PublicMedia, 'id' | 'src' | 'width' | 'height' | 'variants'>) {
  const og = media.variants.find((item) => item.file === 'og.jpg' && item.width > 0 && item.height > 0)
  if (og) {
    return {
      path: `/media/${media.id}/og.jpg`,
      width: og.width,
      height: og.height,
      type: 'image/jpeg' as const,
    }
  }
  const type = media.src.endsWith('.webp')
    ? 'image/webp' as const
    : media.src.endsWith('.avif')
      ? 'image/avif' as const
      : media.src.endsWith('.png')
        ? 'image/png' as const
        : undefined
  return {
    path: media.src,
    width: media.width,
    height: media.height,
    type,
  }
}

export function lcpPreload(media: PublicMedia, sizes: string) {
  const avif = variantSrcset(media, 'avif')
  const webp = variantSrcset(media, 'webp')
  const imagesrcset = avif || webp
  if (!imagesrcset) {
    return null
  }
  return {
    key: 'lcp-image',
    rel: 'preload' as const,
    as: 'image' as const,
    type: avif ? 'image/avif' : 'image/webp',
    imagesrcset,
    imagesizes: sizes,
    fetchpriority: 'high' as const,
  }
}
