import process from 'node:process'
import { auditSourceLists, sourceAuditExitCode } from '@k39/database/source-audit'

const report = await auditSourceLists(process.env.DATABASE_URL)
// Exit after flushing JSON, including when a failed cleanup left a socket open.
process.stdout.write(`${JSON.stringify(report)}\n`, () => process.exit(sourceAuditExitCode(report)))
