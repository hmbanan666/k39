import { createError } from 'h3'

const hits = new Map<string, number[]>()

export function takeCabinetSlot(key: string, limit: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    throw createError({ statusCode: 429, statusMessage: 'Слишком много запросов. Попробуйте чуть позже.' })
  }
  recent.push(now)
  hits.set(key, recent)
  return recent.length
}

export function resetCabinetSlots() {
  hits.clear()
}

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

export function limitClaimStart(userId: string, now = Date.now()) {
  return takeCabinetSlot(`claim:${userId}`, 5, HOUR, now)
}

export function limitCodeSend(userId: string, now = Date.now()) {
  takeCabinetSlot(`code:${userId}`, 5, HOUR, now)
}

export function limitCodeCheck(userId: string, now = Date.now()) {
  takeCabinetSlot(`verify:${userId}`, 10, 15 * MINUTE, now)
}

export function limitSearch(userId: string, now = Date.now()) {
  takeCabinetSlot(`search:${userId}`, 30, MINUTE, now)
}

export function limitEdit(userId: string, now = Date.now()) {
  takeCabinetSlot(`edit:${userId}`, 30, MINUTE, now)
}

export function limitUpload(userId: string, now = Date.now()) {
  takeCabinetSlot(`media:${userId}`, 10, HOUR, now)
}
