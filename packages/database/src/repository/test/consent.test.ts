import { describe, expect, it } from 'vitest'
import { Consent } from '../consent'
import { User } from '../user'

describe('user consents', () => {
  it('keeps one active row and records a new one after withdrawal', async () => {
    const user = await User.create({ email: 'consent@example.com', name: 'Гость' })
    const first = await Consent.record({ userId: user.id, version: '2026-10-12', method: 'sign-in-button' })
    const again = await Consent.record({ userId: user.id, version: '2026-10-12', method: 'sign-in-button' })
    expect(again.id).toBe(first.id)
    expect(first.withdrawnAt).toBeNull()

    const withdrawn = await Consent.withdraw(first.id)
    expect(withdrawn?.withdrawnAt).toBeTruthy()
    const repeat = await Consent.withdraw(first.id)
    expect(repeat?.id).toBe(first.id)
    expect(await Consent.active(user.id, '2026-10-12')).toBeUndefined()

    const next = await Consent.record({ userId: user.id, version: '2026-10-12', method: 'sign-in-button' })
    expect(next.id).not.toBe(first.id)
    const rows = (await Consent.list()).filter((row) => row.userId === user.id)
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.id === next.id)?.email).toBe('consent@example.com')
    expect(await Consent.withdraw('missing-consent')).toBeUndefined()
  })
})
