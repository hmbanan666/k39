import { db } from '@k39/database'
import { z } from 'zod'
import { reviewUpdate } from '../../../shared/facts'
import { loadPageSnapshot } from '../../utils/facts/pages'
import { syncPageSections } from '../../utils/facts/queue'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { resolveScoredPage } from '../../utils/scoring/run'

export default defineStrictMcpTool({
  name: 'page_mark_reviewed',
  description: 'Store section hashes for one page. all true accepts every current section only when each hash still matches the text. A path that changed since the read is rejected and left open. Does not confirm facts and does not move last_verified_at. Writes an mcp_audits row.',
  inputSchema: {
    path: z.string().optional(),
    pageType: z.enum(['place', 'route', 'collection', 'hub', 'quest', 'venue']).optional(),
    slug: z.string().optional(),
    all: z.boolean().optional(),
    sections: z.array(z.object({ path: z.string(), hash: z.string() })).default([]),
  },
  handler: async (input) => {
    const page = await resolveScoredPage({ path: input.path, pageType: input.pageType, slug: input.slug })
    if (!page) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
    }
    const snapshot = await loadPageSnapshot(page.pageType, page.entityId)
    if (!snapshot) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
    }
    const stored = (await db.facts.review(page.pageType, page.entityId))?.sections ?? []
    const next = reviewUpdate(snapshot.sections, stored, input.sections, input.all === true)
    if (next.ok || next.sections !== stored) {
      await db.facts.saveReview({
        pageType: page.pageType,
        entityId: page.entityId,
        reviewer: 'mcp',
        sections: next.sections,
      })
    }
    await syncPageSections(page.pageType, page.entityId)
    await auditMcp('page_mark_reviewed', page.pageType, page.entityId)
    return { path: page.path, accepted: next.ok, rejected: next.rejected, sections: next.sections }
  },
})
