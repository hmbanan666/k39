import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { requireEditorContent, withContentScope } from '../server/utils/access'
import { GUEST_FACE_REJECT_NOTE, routeGuestDecision } from '../shared/guest'

const root = resolve(process.cwd(), 'apps/web-app')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('guest moderation token scope', () => {
  it('lets the editor token through and refuses the draft token', async () => {
    await withContentScope('editor', async () => {
      expect(() => requireEditorContent('approve a guest submission')).not.toThrow()
    })
    await withContentScope('draft', async () => {
      expect(() => requireEditorContent('approve a guest submission')).toThrowError()
      try {
        requireEditorContent('reject a guest submission')
      } catch (error) {
        expect((error as { statusCode: number }).statusCode).toBe(403)
        expect((error as { statusMessage: string }).statusMessage).toContain('Draft token cannot')
      }
    })
  })

  it('gates every guest moderation tool on the editor token', () => {
    const tools = [
      'server/mcp/tools/guests-pending-list.ts',
      'server/mcp/tools/guest-approve.ts',
      'server/mcp/tools/guest-reject.ts',
      'server/mcp/tools/guest-dispute-flag.ts',
    ].map(read)
    for (const source of tools) {
      expect(source).toContain('requireEditorContent')
      expect(source).not.toContain('CONTENT_DRAFT_TOKEN')
    }
    expect(tools[1]).toContain('recognizableFace')
    expect(tools[2]).toContain('reason')
  })
})

describe('guest moderation parity', () => {
  it('sends a recognizable face to the same reject note the author sees', () => {
    expect(
      routeGuestDecision({
        kind: 'photo',
        decision: 'accept',
        recognizableFace: true,
      }),
    ).toEqual({ decision: 'reject', note: GUEST_FACE_REJECT_NOTE })
    expect(
      routeGuestDecision({
        kind: 'photo',
        decision: 'accept',
        recognizableFace: false,
      }),
    ).toEqual({ decision: 'accept', note: null })
    expect(
      routeGuestDecision({
        kind: 'review',
        decision: 'accept',
        recognizableFace: true,
      }),
    ).toEqual({ decision: 'accept', note: null })
    expect(
      routeGuestDecision({
        kind: 'correction',
        decision: 'reject',
        note: 'Реклама',
      }),
    ).toEqual({ decision: 'reject', note: 'Реклама' })
    expect(
      routeGuestDecision({
        kind: 'tip',
        decision: 'dispute',
      }).decision,
    ).toBe('dispute')
  })

  it('points the admin route and the MCP tools at moderateGuest', () => {
    const admin = read('server/api/admin/guests/[id].post.ts')
    const approve = read('server/mcp/tools/guest-approve.ts')
    const reject = read('server/mcp/tools/guest-reject.ts')
    const dispute = read('server/mcp/tools/guest-dispute-flag.ts')
    const writer = read('server/utils/guests/moderate.ts')
    for (const source of [admin, approve, reject, dispute]) {
      expect(source).toContain('moderateGuest')
    }
    expect(admin).not.toContain('acceptGuest')
    expect(approve).not.toContain('acceptGuest')
    expect(writer).toContain('routeGuestDecision')
    expect(writer).toContain('rejectGuest')
    expect(writer).toContain('acceptGuest')
    expect(writer).toContain('disputeGuest')
  })
})
