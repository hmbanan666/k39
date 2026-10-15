import process from 'node:process'

export class ClaimDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClaimDeliveryError'
  }
}

export interface ClaimCodeBody {
  channel: 'email' | 'phone'
  to: string
  code: string
  venue: string
}

/** POST the code to the operator's mailer or SMS gateway. The code is the body, never a log line. */
export async function postClaimCode(input: {
  url: string
  token?: string
  body: ClaimCodeBody
  fetchImpl?: typeof fetch
}) {
  let parsed: URL
  try {
    parsed = new URL(input.url)
  } catch {
    throw new ClaimDeliveryError('delivery_url')
  }
  if (parsed.protocol !== 'https:') {
    throw new ClaimDeliveryError('delivery_url')
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (input.token) {
    headers.authorization = `Bearer ${input.token}`
  }
  const response = await (input.fetchImpl ?? fetch)(parsed, {
    method: 'POST',
    headers,
    body: JSON.stringify(input.body),
  })
  if (!response.ok) {
    throw new ClaimDeliveryError('delivery_failed')
  }
}

export function claimTransportConfig() {
  return {
    emailUrl: process.env.CLAIM_EMAIL_URL?.trim() || '',
    phoneUrl: process.env.CLAIM_SMS_URL?.trim() || '',
    token: process.env.CLAIM_DELIVERY_TOKEN?.trim() || '',
  }
}
