export interface ByteSpan {
  start: number
  end: number
}

// Inclusive byte range from an HTTP Range header. PMTiles reads the archive with Range.
export function byteSpan(header: string | undefined, size: number): ByteSpan | 'all' | 'unsatisfiable' {
  if (!header) {
    return 'all'
  }
  if (size <= 0) {
    return 'unsatisfiable'
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) {
    return 'unsatisfiable'
  }
  const startRaw = match[1] ?? ''
  const endRaw = match[2] ?? ''
  if (startRaw === '' && endRaw === '') {
    return 'unsatisfiable'
  }
  if (startRaw === '') {
    const suffix = Number(endRaw)
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return 'unsatisfiable'
    }
    const start = Math.max(0, size - suffix)
    return { start, end: size - 1 }
  }
  const start = Number(startRaw)
  if (!Number.isFinite(start) || start < 0 || start >= size) {
    return 'unsatisfiable'
  }
  const end = endRaw === '' ? size - 1 : Number(endRaw)
  if (!Number.isFinite(end) || end < start) {
    return 'unsatisfiable'
  }
  return { start, end: Math.min(end, size - 1) }
}
