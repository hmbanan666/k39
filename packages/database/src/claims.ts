import { Buffer } from 'node:buffer'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'

export const CLAIM_CODE_TTL_MS = 15 * 60 * 1000
export const CLAIM_MAX_ATTEMPTS = 5

export type ClaimChannel = 'email' | 'phone' | 'manual'
export type ClaimStatus = 'pending' | 'verified' | 'rejected' | 'withdrawn'
export type VenueMemberRole = 'owner' | 'editor'
export type VenueAuditAction = 'claim_verified' | 'claim_rejected' | 'owner_update' | 'photo_upload' | 'photo_delete' | 'revert'

export function newClaimCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashClaimCode(input: { pepper: string, venueId: string, userId: string, code: string }) {
  return createHash('sha256')
    .update(`${input.pepper}\n${input.venueId}\n${input.userId}\n${input.code}`)
    .digest('hex')
}

export function claimCodesMatch(stored: string, computed: string) {
  const left = Buffer.from(stored)
  const right = Buffer.from(computed)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}
