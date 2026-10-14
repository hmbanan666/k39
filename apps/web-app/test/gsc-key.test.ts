import { describe, expect, it } from 'vitest'
import { escapeControlCharsInStrings, parseServiceAccountKey } from '../server/utils/analytics/gsc-key'

const key = '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n'
const clean = JSON.stringify({ type: 'service_account', client_email: 'bot@x.iam', private_key: key })

describe('parseServiceAccountKey', () => {
  it('parses a normal one-line key', () => {
    expect(parseServiceAccountKey(clean).private_key).toBe(key)
  })

  it('parses a key whose \\n escapes became real newlines', () => {
    const broken = clean.replaceAll('\\n', '\n')
    expect(() => JSON.parse(broken)).toThrow()
    expect(parseServiceAccountKey(broken).private_key).toBe(key)
  })

  it('handles CRLF and pretty-printed JSON', () => {
    const pretty = JSON.stringify(JSON.parse(clean), null, 2).replaceAll('\\n', '\r\n').replaceAll('\n', '\r\n')
    expect(parseServiceAccountKey(pretty).client_email).toBe('bot@x.iam')
  })

  it('throws a clear error without leaking the secret', () => {
    expect(() => parseServiceAccountKey('{"private_key":"SECRET'))
      .toThrow(/^GSC_SERVICE_ACCOUNT_JSON is not valid JSON$/)
    expect(() => parseServiceAccountKey('{"private_key":"SECRET"}'))
      .toThrow(/must contain client_email/)
  })

  it('keeps escaped quotes intact', () => {
    expect(escapeControlCharsInStrings('{"a":"x\\"\ny"}')).toBe('{"a":"x\\"\\ny"}')
  })
})
