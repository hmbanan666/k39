import type { ClaimChannel, VenueAuditAction, VenueMemberRole } from '../claims'
import type { ContentTx } from './content'
import { and, desc, eq, sql } from 'drizzle-orm'
import { CLAIM_MAX_ATTEMPTS, claimCodesMatch, hashClaimCode } from '../claims'
import { useDatabase } from '../database'
import { users, venueAudits, venueClaims, venueMembers, venues } from '../tables'
import { VenueInputError } from '../venues'

export type ClaimFail = 'missing' | 'closed' | 'expired' | 'locked' | 'mismatch' | 'taken'

function isUnique(error: unknown) {
  let current: unknown = error
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth += 1) {
    if ((current as { code?: string }).code === '23505') {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}

type ClaimTx = Parameters<Parameters<ReturnType<typeof useDatabase>['transaction']>[0]>[0]

async function grantOwner(tx: ClaimTx, venueId: string, userId: string) {
  const [existing] = await tx.select().from(venueMembers).where(and(
    eq(venueMembers.venueId, venueId),
    eq(venueMembers.role, 'owner'),
  )).limit(1)
  if (existing) {
    return existing.userId === userId
  }
  try {
    await tx.insert(venueMembers).values({ venueId, userId, role: 'owner' })
    return true
  } catch (error) {
    if (isUnique(error)) {
      return false
    }
    throw error
  }
}

async function rejectSiblings(tx: ClaimTx, venueId: string, keepId: string, now: string) {
  await tx.update(venueClaims).set({
    status: 'rejected',
    decidedAt: now,
    updatedAt: now,
    codeHash: null,
  }).where(and(
    eq(venueClaims.venueId, venueId),
    eq(venueClaims.status, 'pending'),
    sql`${venueClaims.id} <> ${keepId}`,
  ))
}

export class VenueClaims {
  static async member(venueId: string, userId: string) {
    const [row] = await useDatabase().select().from(venueMembers).where(and(
      eq(venueMembers.venueId, venueId),
      eq(venueMembers.userId, userId),
    )).limit(1)
    return row
  }

  static async owner(venueId: string) {
    const [row] = await useDatabase().select().from(venueMembers).where(and(
      eq(venueMembers.venueId, venueId),
      eq(venueMembers.role, 'owner'),
    )).limit(1)
    return row
  }

  static async forUser(userId: string) {
    return useDatabase()
      .select({
        venueId: venueMembers.venueId,
        role: venueMembers.role,
        name: venues.name,
        slug: venues.slug,
        status: venues.status,
      })
      .from(venueMembers)
      .innerJoin(venues, eq(venues.id, venueMembers.venueId))
      .where(eq(venueMembers.userId, userId))
      .orderBy(venues.name)
  }

  static async addMember(venueId: string, userId: string, role: VenueMemberRole) {
    if (role === 'owner') {
      const current = await this.owner(venueId)
      if (current && current.userId !== userId) {
        throw new VenueInputError('У заведения уже есть владелец')
      }
    }
    const existing = await this.member(venueId, userId)
    if (existing) {
      return existing
    }
    const [row] = await useDatabase().insert(venueMembers).values({ venueId, userId, role }).returning()
    if (!row) {
      throw new VenueInputError('Не удалось выдать доступ')
    }
    return row
  }

  static async pending(venueId: string, userId: string) {
    const [row] = await useDatabase().select().from(venueClaims).where(and(
      eq(venueClaims.venueId, venueId),
      eq(venueClaims.userId, userId),
      eq(venueClaims.status, 'pending'),
    )).limit(1)
    return row
  }

  static async byId(id: string) {
    const [row] = await useDatabase().select().from(venueClaims).where(eq(venueClaims.id, id)).limit(1)
    return row
  }

  static async createPending(input: {
    venueId: string
    userId: string
    channel: ClaimChannel
    destination: string | null
    evidence: string | null
    codeHash: string | null
    codeExpiresAt: string | null
  }) {
    const open = await this.pending(input.venueId, input.userId)
    if (open) {
      return { claim: open, created: false as const }
    }
    try {
      const [row] = await useDatabase().insert(venueClaims).values({
        venueId: input.venueId,
        userId: input.userId,
        status: 'pending',
        channel: input.channel,
        destination: input.destination,
        evidence: input.evidence,
        codeHash: input.codeHash,
        codeExpiresAt: input.codeExpiresAt,
      }).returning()
      if (!row) {
        throw new VenueInputError('Не удалось сохранить заявку')
      }
      return { claim: row, created: true as const }
    } catch (error) {
      if (!isUnique(error)) {
        throw error
      }
      const again = await this.pending(input.venueId, input.userId)
      if (again) {
        return { claim: again, created: false as const }
      }
      throw error
    }
  }

  static async setCode(id: string, userId: string, codeHash: string, codeExpiresAt: string) {
    const [row] = await useDatabase().update(venueClaims).set({
      codeHash,
      codeExpiresAt,
      attempts: 0,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(venueClaims.id, id),
      eq(venueClaims.userId, userId),
      eq(venueClaims.status, 'pending'),
    )).returning()
    return row
  }

  static async consumeCode(input: { claimId: string, userId: string, code: string, pepper: string, now?: Date }) {
    const now = (input.now ?? new Date()).toISOString()
    return useDatabase().transaction(async (tx) => {
      const [claim] = await tx.select().from(venueClaims).where(eq(venueClaims.id, input.claimId)).limit(1).for('update')
      if (!claim || claim.userId !== input.userId) {
        return { ok: false as const, reason: 'missing' as const }
      }
      if (claim.status !== 'pending' || claim.channel === 'manual' || !claim.codeHash) {
        return { ok: false as const, reason: claim.attempts >= CLAIM_MAX_ATTEMPTS ? 'locked' as const : 'closed' as const }
      }
      if (!claim.codeExpiresAt || new Date(claim.codeExpiresAt).getTime() <= new Date(now).getTime()) {
        return { ok: false as const, reason: 'expired' as const }
      }
      if (claim.attempts >= CLAIM_MAX_ATTEMPTS) {
        return { ok: false as const, reason: 'locked' as const }
      }
      const computed = hashClaimCode({
        pepper: input.pepper,
        venueId: claim.venueId,
        userId: claim.userId,
        code: input.code,
      })
      if (!claimCodesMatch(claim.codeHash, computed)) {
        const attempts = claim.attempts + 1
        const locked = attempts >= CLAIM_MAX_ATTEMPTS
        await tx.update(venueClaims).set({
          attempts,
          codeHash: locked ? null : claim.codeHash,
          codeExpiresAt: locked ? null : claim.codeExpiresAt,
          updatedAt: now,
        }).where(eq(venueClaims.id, claim.id))
        return { ok: false as const, reason: locked ? 'locked' as const : 'mismatch' as const }
      }
      const granted = await grantOwner(tx, claim.venueId, claim.userId)
      if (!granted) {
        await tx.update(venueClaims).set({
          status: 'rejected',
          codeHash: null,
          decidedAt: now,
          updatedAt: now,
        }).where(eq(venueClaims.id, claim.id))
        return { ok: false as const, reason: 'taken' as const }
      }
      await tx.update(venueClaims).set({
        status: 'verified',
        codeHash: null,
        decidedAt: now,
        updatedAt: now,
      }).where(eq(venueClaims.id, claim.id))
      await rejectSiblings(tx, claim.venueId, claim.id, now)
      await tx.insert(venueAudits).values({
        venueId: claim.venueId,
        actorUserId: claim.userId,
        action: 'claim_verified',
        summary: { channel: claim.channel, claimId: claim.id },
      })
      return { ok: true as const, venueId: claim.venueId }
    })
  }

  static async decide(input: { claimId: string, adminId: string, decision: 'approve' | 'reject', now?: Date }) {
    const now = (input.now ?? new Date()).toISOString()
    return useDatabase().transaction(async (tx) => {
      const [claim] = await tx.select().from(venueClaims).where(eq(venueClaims.id, input.claimId)).limit(1).for('update')
      if (!claim || claim.status !== 'pending') {
        return { ok: false as const, reason: 'missing' as const }
      }
      if (input.decision === 'reject') {
        await tx.update(venueClaims).set({
          status: 'rejected',
          codeHash: null,
          decidedAt: now,
          decidedBy: input.adminId,
          updatedAt: now,
        }).where(eq(venueClaims.id, claim.id))
        await tx.insert(venueAudits).values({
          venueId: claim.venueId,
          actorUserId: input.adminId,
          action: 'claim_rejected',
          summary: { channel: claim.channel, claimId: claim.id },
        })
        return { ok: true as const, venueId: claim.venueId, decision: 'reject' as const }
      }
      const granted = await grantOwner(tx, claim.venueId, claim.userId)
      if (!granted) {
        await tx.update(venueClaims).set({
          status: 'rejected',
          codeHash: null,
          decidedAt: now,
          decidedBy: input.adminId,
          updatedAt: now,
        }).where(eq(venueClaims.id, claim.id))
        return { ok: false as const, reason: 'taken' as const }
      }
      await tx.update(venueClaims).set({
        status: 'verified',
        codeHash: null,
        decidedAt: now,
        decidedBy: input.adminId,
        updatedAt: now,
      }).where(eq(venueClaims.id, claim.id))
      await rejectSiblings(tx, claim.venueId, claim.id, now)
      await tx.insert(venueAudits).values({
        venueId: claim.venueId,
        actorUserId: input.adminId,
        action: 'claim_verified',
        summary: { channel: claim.channel, claimId: claim.id, via: 'admin' },
      })
      return { ok: true as const, venueId: claim.venueId, decision: 'approve' as const }
    })
  }

  static async listPending(limit = 100) {
    return useDatabase()
      .select({
        id: venueClaims.id,
        createdAt: venueClaims.createdAt,
        channel: venueClaims.channel,
        destination: venueClaims.destination,
        evidence: venueClaims.evidence,
        attempts: venueClaims.attempts,
        venueId: venueClaims.venueId,
        venueName: venues.name,
        venueSlug: venues.slug,
        userId: venueClaims.userId,
        userEmail: users.email,
        userName: users.name,
      })
      .from(venueClaims)
      .innerJoin(venues, eq(venues.id, venueClaims.venueId))
      .innerJoin(users, eq(users.id, venueClaims.userId))
      .where(eq(venueClaims.status, 'pending'))
      .orderBy(desc(venueClaims.createdAt))
      .limit(limit)
  }

  static async audit(venueId: string, actorUserId: string | null, action: VenueAuditAction, summary: Record<string, unknown>, tx?: ContentTx) {
    const [row] = await (tx ?? useDatabase()).insert(venueAudits).values({
      venueId,
      actorUserId,
      action,
      summary,
      createdAt: new Date().toISOString(),
    }).returning()
    return row
  }

  static async audits(venueId: string, limit = 40) {
    return useDatabase()
      .select({
        id: venueAudits.id,
        createdAt: venueAudits.createdAt,
        action: venueAudits.action,
        summary: venueAudits.summary,
        actorUserId: venueAudits.actorUserId,
        actorEmail: users.email,
      })
      .from(venueAudits)
      .leftJoin(users, eq(users.id, venueAudits.actorUserId))
      .where(eq(venueAudits.venueId, venueId))
      .orderBy(desc(venueAudits.createdAt))
      .limit(limit)
  }
}
