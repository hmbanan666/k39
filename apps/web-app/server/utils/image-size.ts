export function readImageSize(bytes: Uint8Array, mime: string) {
  if (mime === 'image/png' && bytes.length > 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (mime === 'image/gif' && bytes.length > 10) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  }
  if ((mime === 'image/jpeg' || mime === 'image/jpg') && bytes.length > 4) {
    let offset = 2
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        break
      }
      const marker = bytes[offset + 1] ?? 0
      const size = ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0)
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          width: ((bytes[offset + 7] ?? 0) << 8) + (bytes[offset + 8] ?? 0),
          height: ((bytes[offset + 5] ?? 0) << 8) + (bytes[offset + 6] ?? 0),
        }
      }
      offset += 2 + size
    }
  }
  if (mime === 'image/webp') {
    return readWebpSize(bytes)
  }
  return { width: null, height: null }
}

function readWebpSize(bytes: Uint8Array) {
  if (bytes.length < 30) {
    return { width: null, height: null }
  }
  const tag = (start: number) =>
    String.fromCharCode(bytes[start] ?? 0, bytes[start + 1] ?? 0, bytes[start + 2] ?? 0, bytes[start + 3] ?? 0)
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') {
    return { width: null, height: null }
  }
  if (tag(12) === 'VP8X') {
    return {
      width: 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16),
      height: 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16),
    }
  }
  if (tag(12) === 'VP8L' && bytes[20] === 0x2f) {
    const b1 = bytes[21] ?? 0
    const b2 = bytes[22] ?? 0
    const b3 = bytes[23] ?? 0
    const b4 = bytes[24] ?? 0
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    }
  }
  return { width: null, height: null }
}
