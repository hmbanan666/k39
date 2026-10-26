// Accepts the same-origin archive path or an https object-storage URL. Anything else is OpenFreeMap.
export function acceptedBasemapUrl(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }
  const url = value.trim()
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url
  }
  if (/^https?:\/\//i.test(url)) {
    return url
  }
  return ''
}

async function readBasemapPayload(path: string) {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(String(response.status))
  }
  return (await response.json()) as { pmtilesUrl?: unknown }
}

export async function fetchBasemapUrl(get: (path: string) => Promise<{ pmtilesUrl?: unknown }> = readBasemapPayload) {
  try {
    const body = await get('/api/public/basemap')
    return acceptedBasemapUrl(body?.pmtilesUrl)
  } catch {
    return ''
  }
}
