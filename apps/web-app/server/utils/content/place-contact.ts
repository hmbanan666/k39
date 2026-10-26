import type { ContentTx } from '@k39/database'
import type { Checked } from '../../../shared/place-contact'
import { db } from '@k39/database'
import { createError } from 'h3'
import {
  checkPlacePhone,
  checkPlacePhoneSource,
  checkPlaceSchemaType,
  checkPlaceWebsite,
} from '../../../shared/place-contact'

/** Writer fields for #238 and #239. `undefined` keeps the stored value. */
export interface PlaceContactInput {
  phone?: string | null
  /** Official page the phone was read from. Defaults to the stored fact source, then `website`. */
  phoneSourceUrl?: string | null
  website?: string | null
  schemaType?: string | null
}

export interface PlaceContact {
  phone: string | null
  website: string | null
  schemaType: string | null
  /** Source of the phone fact. Null when there is no phone. */
  phoneSourceUrl: string | null
}

function must<T>(checked: Checked<T>): T {
  if (!checked.ok) {
    throw createError({ statusCode: 400, statusMessage: checked.message })
  }
  return checked.value
}

/** Source URL of the live phone fact, or null. */
export async function placePhoneSource(placeId: string, tx?: ContentTx) {
  return (await db.facts.liveSlot('place', placeId, 'phone', tx))?.sourceUrl ?? null
}

/**
 * Checks and merges the contact fields of one write. `fallback` is what the
 * row (or a pending payload) holds now. A phone without an official source
 * is a 400 before anything is written.
 */
export async function resolvePlaceContact(
  input: PlaceContactInput,
  fallback: {
    placeId: string | null
    phone: string | null
    website: string | null
    schemaType: string | null
    phoneSourceUrl?: string | null
  },
): Promise<PlaceContact> {
  const phone = input.phone === undefined ? fallback.phone : must(checkPlacePhone(input.phone))
  const website = input.website === undefined ? fallback.website : must(checkPlaceWebsite(input.website))
  const schemaType = input.schemaType === undefined ? fallback.schemaType : must(checkPlaceSchemaType(input.schemaType))
  if (!phone) {
    return { phone: null, website, schemaType, phoneSourceUrl: null }
  }
  let source = input.phoneSourceUrl
  if (source === undefined) {
    source =
      fallback.phoneSourceUrl !== undefined
        ? fallback.phoneSourceUrl
        : fallback.placeId
          ? await placePhoneSource(fallback.placeId)
          : null
  }
  const phoneSourceUrl = must(checkPlacePhoneSource(source?.trim() || website, website))
  return { phone, website, schemaType, phoneSourceUrl }
}

/** The day the phone was checked: the write's `factsCheckedAt`, otherwise now. */
export function phoneCheckedAt(checked: string | null | undefined) {
  return checked || new Date().toISOString()
}
