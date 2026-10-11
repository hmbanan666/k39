import { db } from '@k39/database'

export async function auditMcp(tool: string, entityType?: string | null, entityId?: string | null) {
  await db.editor.recordMcpAudit({ tool, entityType, entityId })
}
