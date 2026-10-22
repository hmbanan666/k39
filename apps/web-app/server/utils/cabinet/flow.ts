import type { ClaimChannel } from '@k39/database'
import type { VenueModule } from '../../../shared/venue-modules'
import process from 'node:process'
import { CLAIM_CODE_TTL_MS, db, hashClaimCode, HOURS_NOTE_TOO_LONG, newClaimCode, VenueInputError } from '@k39/database'
import { createError } from 'h3'
import { claimChannelPlan, ownerVenueSchema, pickOwnerFields } from '../../../shared/cabinet'
import { verifiedDate } from '../../../shared/schedule'
import { contentGate, updateVenueContent } from '../content/save'
import { readShownFacts, shownText } from '../facts/read'
import { setVenuePrices, syncVenueContact } from '../facts/sync'
import { normalizeDishModules } from '../venues/dishes'
import { recomputeTownPriceBands } from '../venues/price-band'
import { asOwnerPrices, venuePricesWriteSchema } from '../venues/prices'
import { planVenueSchedule, saveVenueSchedule } from '../venues/write'
import { ClaimDeliveryError, claimTransportConfig, postClaimCode } from './deliver'
import { limitClaimStart, limitCodeCheck, limitCodeSend, limitEdit } from './rate'

async function venuePhone(venue: { id: string, phone: string | null, address: string | null, status: string }) {
  const shown = (await readShownFacts('venue', [venue])).get(venue.id)
  return shownText(shown?.phone, venue.phone)
}

function fail(statusCode: number, statusMessage: string): never {
  throw createError({ statusCode, statusMessage })
}

function formProblem(issues: Array<{ message: string }>, fallback: string) {
  const issue = issues.find((item) => item.message.startsWith('Цену пишите') || item.message.startsWith('Нельзя использовать') || item.message === HOURS_NOTE_TOO_LONG)
  return issue?.message ?? fallback
}

function pepper() {
  const value = process.env.NUXT_SESSION_PASSWORD
  if (!value || value.length < 32) {
    fail(503, 'Проверка кода не настроена')
  }
  return value
}

function transports() {
  const config = claimTransportConfig()
  return {
    emailTransport: Boolean(config.emailUrl),
    phoneTransport: Boolean(config.phoneUrl),
    config,
  }
}

async function loadClaimable(slugOrId: { slug?: string, id?: string }) {
  const venue = slugOrId.id
    ? await db.venues.byId(slugOrId.id)
    : slugOrId.slug
      ? await db.venues.bySlug(slugOrId.slug)
      : null
  if (!venue || (venue.status !== 'published' && venue.status !== 'closed')) {
    fail(404, 'Заведение не найдено')
  }
  return venue
}

export async function claimPreview(userId: string, slug: string) {
  const venue = await loadClaimable({ slug })
  const member = await db.venueClaims.member(venue.id, userId)
  const claim = await db.venueClaims.pending(venue.id, userId)
  const { emailTransport, phoneTransport } = transports()
  const phone = await venuePhone(venue)
  const plan = claimChannelPlan({
    phone,
    contactEmail: venue.contactEmail,
    emailTransport,
    phoneTransport,
  })
  return {
    venue: {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      address: venue.address,
      kind: venue.kind,
    },
    channels: plan,
    membership: member?.role ?? null,
    claim: claim
      ? {
          id: claim.id,
          status: claim.status,
          channel: claim.channel,
          mask: claim.channel === 'email' ? plan.email.mask : claim.channel === 'phone' ? plan.phone.mask : null,
          expiresAt: claim.codeExpiresAt,
        }
      : null,
  }
}

export async function startClaim(userId: string, input: { slug: string, channel: ClaimChannel, evidence?: string | null }, deps?: {
  fetchImpl?: typeof fetch
  now?: Date
}) {
  limitClaimStart(userId, deps?.now?.getTime())
  const venue = await loadClaimable({ slug: input.slug })
  const member = await db.venueClaims.member(venue.id, userId)
  if (member) {
    fail(409, 'Вы уже управляете этой страницей')
  }
  const owner = await db.venueClaims.owner(venue.id)
  if (owner) {
    fail(409, 'У этой страницы уже есть владелец')
  }
  const { emailTransport, phoneTransport, config } = transports()
  const phone = await venuePhone(venue)
  const plan = claimChannelPlan({
    phone,
    contactEmail: venue.contactEmail,
    emailTransport,
    phoneTransport,
  })
  if (input.channel === 'email' || input.channel === 'phone') {
    const side = input.channel === 'email' ? plan.email : plan.phone
    if (!side.present) {
      fail(409, input.channel === 'email'
        ? 'У заведения нет почты, на которую можно отправить код'
        : 'У заведения нет телефона, на который можно отправить код')
    }
    if (!side.transport) {
      fail(409, 'Отправка кода пока не подключена. Оставьте заявку на проверку редакцией.')
    }
  }
  const evidence = input.evidence?.trim() || ''
  if (input.channel === 'manual' && (evidence.length < 20 || evidence.length > 2000)) {
    fail(400, 'Напишите, как мы поймём, что страница ваша: от 20 до 2000 знаков')
  }
  const open = await db.venueClaims.pending(venue.id, userId)
  if (open) {
    if (open.channel !== input.channel) {
      fail(409, 'Заявка уже отправлена. Дождитесь проверки или введите код.')
    }
    return {
      id: open.id,
      status: open.status,
      channel: open.channel,
      created: false,
      mask: input.channel === 'email' ? plan.email.mask : input.channel === 'phone' ? plan.phone.mask : null,
      expiresAt: open.codeExpiresAt,
    }
  }

  let codeHash: string | null = null
  let codeExpiresAt: string | null = null
  let destination: string | null = null
  if (input.channel === 'email' || input.channel === 'phone') {
    limitCodeSend(userId, deps?.now?.getTime())
    destination = input.channel === 'email' ? venue.contactEmail : phone
    const code = newClaimCode()
    codeHash = hashClaimCode({ pepper: pepper(), venueId: venue.id, userId, code })
    codeExpiresAt = new Date((deps?.now?.getTime() ?? Date.now()) + CLAIM_CODE_TTL_MS).toISOString()
    try {
      await postClaimCode({
        url: input.channel === 'email' ? config.emailUrl : config.phoneUrl,
        token: config.token || undefined,
        body: { channel: input.channel, to: destination || '', code, venue: venue.name },
        fetchImpl: deps?.fetchImpl,
      })
    } catch (error) {
      if (error instanceof ClaimDeliveryError) {
        fail(502, 'Не удалось отправить код. Оставьте заявку на проверку редакцией.')
      }
      throw error
    }
  }

  const saved = await db.venueClaims.createPending({
    venueId: venue.id,
    userId,
    channel: input.channel,
    destination,
    evidence: input.channel === 'manual' ? evidence : null,
    codeHash,
    codeExpiresAt,
  })
  return {
    id: saved.claim.id,
    status: saved.claim.status,
    channel: saved.claim.channel,
    created: saved.created,
    mask: input.channel === 'email' ? plan.email.mask : input.channel === 'phone' ? plan.phone.mask : null,
    expiresAt: saved.claim.codeExpiresAt,
  }
}

export async function resendClaimCode(userId: string, claimId: string, deps?: { fetchImpl?: typeof fetch, now?: Date }) {
  limitCodeSend(userId, deps?.now?.getTime())
  const claim = await db.venueClaims.byId(claimId)
  if (!claim || claim.userId !== userId) {
    fail(404, 'Заявка не найдена')
  }
  if (claim.status !== 'pending' || (claim.channel !== 'email' && claim.channel !== 'phone')) {
    fail(409, 'Для этой заявки код не отправляется')
  }
  const venue = await db.venues.byId(claim.venueId)
  if (!venue) {
    fail(404, 'Заведение не найдено')
  }
  const { config } = transports()
  const url = claim.channel === 'email' ? config.emailUrl : config.phoneUrl
  const destination = claim.channel === 'email' ? venue.contactEmail : await venuePhone(venue)
  if (!url || !destination) {
    fail(409, 'Отправка кода пока не подключена. Оставьте заявку на проверку редакцией.')
  }
  const code = newClaimCode()
  const codeHash = hashClaimCode({ pepper: pepper(), venueId: venue.id, userId, code })
  const codeExpiresAt = new Date((deps?.now?.getTime() ?? Date.now()) + CLAIM_CODE_TTL_MS).toISOString()
  try {
    await postClaimCode({
      url,
      token: config.token || undefined,
      body: { channel: claim.channel, to: destination, code, venue: venue.name },
      fetchImpl: deps?.fetchImpl,
    })
  } catch (error) {
    if (error instanceof ClaimDeliveryError) {
      fail(502, 'Не удалось отправить код. Оставьте заявку на проверку редакцией.')
    }
    throw error
  }
  const saved = await db.venueClaims.setCode(claim.id, userId, codeHash, codeExpiresAt)
  if (!saved) {
    fail(409, 'Заявка уже закрыта')
  }
  return { id: saved.id, expiresAt: saved.codeExpiresAt }
}

export async function verifyClaimCode(userId: string, claimId: string, code: string, now?: Date) {
  limitCodeCheck(userId, now?.getTime())
  if (!/^\d{6}$/.test(code)) {
    fail(400, 'Код — шесть цифр')
  }
  const result = await db.venueClaims.consumeCode({
    claimId,
    userId,
    code,
    pepper: pepper(),
    now,
  })
  if (!result.ok) {
    const message: Record<string, string> = {
      missing: 'Заявка не найдена',
      closed: 'Код для этой заявки не действует',
      expired: 'Срок кода истёк. Запросите новый.',
      locked: 'Слишком много попыток. Запросите новый код.',
      mismatch: 'Код не подошёл',
      taken: 'У этой страницы уже есть владелец',
    }
    fail(result.reason === 'missing' ? 404 : 400, message[result.reason] || 'Код не подошёл')
  }
  return { venueId: result.venueId }
}

export async function requireVenueMember(userId: string, venueId: string) {
  const member = await db.venueClaims.member(venueId, userId)
  if (!member) {
    fail(403, 'Нет доступа к этой странице')
  }
  return member
}

export async function saveOwnerVenue(userId: string, venueId: string, body: Record<string, unknown>) {
  limitEdit(userId)
  await requireVenueMember(userId, venueId)
  const parsed = ownerVenueSchema.safeParse(pickOwnerFields(body))
  if (!parsed.success) {
    fail(400, formProblem(parsed.error.issues, 'Проверьте поля формы'))
  }
  const write = parsed.data
  let ownerPrices: ReturnType<typeof asOwnerPrices> | undefined
  if (Object.prototype.hasOwnProperty.call(body, 'prices')) {
    const prices = venuePricesWriteSchema.safeParse(body.prices)
    if (!prices.success) {
      fail(400, formProblem(prices.error.issues, 'Проверьте ориентиры цен'))
    }
    ownerPrices = asOwnerPrices(prices.data)
  }
  if (write.modules) {
    write.modules = await normalizeDishModules(venueId, write.modules as VenueModule[], 'owner')
  }
  try {
    const current = await db.venues.byId(venueId)
    if (!current) {
      fail(404, 'Заведение не найдено')
    }
    // Only hours that differ from the schedule count as an owner check.
    const schedule = write.hours === undefined ? null : await planVenueSchedule(current, { hours: write.hours })
    const checkedAt = schedule ? new Date() : null
    if (schedule && checkedAt && !schedule.rules.needsCheck) {
      schedule.verifiedAt = verifiedDate(checkedAt)
    }
    if (!schedule) {
      delete write.hours
    }
    const updated = await updateVenueContent(venueId, {
      ...write,
      lastVerifiedAt: checkedAt ? checkedAt.toISOString() : undefined,
    }, userId, contentGate('venue', {
      description: write.description,
      modules: write.modules,
      address: write.address,
      phone: write.phone,
      name: write.name,
      prices: ownerPrices,
    }, current.status === 'published'))
    const saved = updated.row
    if (!saved) {
      fail(404, 'Заведение не найдено')
    }
    await saveVenueSchedule(saved, schedule, 'owner')
    await syncVenueContact({
      venueId,
      actor: 'owner',
      pageStatus: saved.status,
      phone: write.phone,
      address: write.address,
      previous: { phone: current.phone, address: current.address, status: current.status },
    })
    if (ownerPrices) {
      await setVenuePrices(venueId, ownerPrices, 'owner', saved.status)
      await recomputeTownPriceBands(saved.regionId)
    }
    const fields = [...Object.keys(write), ...(ownerPrices ? ['prices'] : [])]
    await db.venueClaims.audit(venueId, userId, 'owner_update', { fields })
    return { id: saved.id, slug: saved.slug }
  } catch (error) {
    if (error instanceof VenueInputError) {
      fail(400, error.message)
    }
    throw error
  }
}

export async function decideClaim(adminId: string, claimId: string, decision: 'approve' | 'reject') {
  const result = await db.venueClaims.decide({ claimId, adminId, decision })
  if (!result.ok) {
    fail(result.reason === 'taken' ? 409 : 404, result.reason === 'taken'
      ? 'У этой страницы уже есть владелец'
      : 'Заявка не найдена')
  }
  return result
}
