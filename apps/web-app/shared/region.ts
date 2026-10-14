/** Display name for eyebrows, filters and hubs: the short town name when set. */
export function regionLabel(region: { title: string, shortTitle?: string | null } | null | undefined) {
  if (!region) {
    return ''
  }
  return region.shortTitle?.trim() || region.title
}
