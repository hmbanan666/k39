export const STYLE_VARIANTS = ['paper'] as const

export type StyleVariant = (typeof STYLE_VARIANTS)[number]

export function isStyleVariant(value: string): value is StyleVariant {
  return (STYLE_VARIANTS as readonly string[]).includes(value)
}
