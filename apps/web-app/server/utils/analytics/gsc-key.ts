export interface ServiceAccountKey {
  client_email: string
  private_key: string
}

/**
 * Escapes raw control characters (newlines, CR, tabs) that appear inside JSON
 * string literals. Env editors often turn the `\n` escapes of a service account
 * key into real line breaks; this restores valid JSON without touching
 * whitespace between tokens.
 */
export function escapeControlCharsInStrings(raw: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (const char of raw) {
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      } else if (char === '\n') {
        out += '\\n'
        continue
      } else if (char === '\r') {
        continue
      } else if (char.charCodeAt(0) < 0x20) {
        out += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
        continue
      }
    } else if (char === '"') {
      inString = true
    }
    out += char
  }
  return out
}

/** Parses GSC_SERVICE_ACCOUNT_JSON. Errors never include the secret value. */
export function parseServiceAccountKey(raw: string): ServiceAccountKey {
  let parsed: unknown
  try {
    parsed = JSON.parse(escapeControlCharsInStrings(raw.trim()))
  } catch {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON is not valid JSON')
  }
  const key = parsed as Partial<ServiceAccountKey> | null
  if (!key || typeof key.client_email !== 'string' || typeof key.private_key !== 'string') {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON must contain client_email and private_key')
  }
  return { client_email: key.client_email, private_key: key.private_key }
}
