import { db } from '@k39/database'
import { z } from 'zod'
import { rulesFromText, rulesFromVenueHours, scheduleRulesSchema, verifiedDate } from '../../../shared/schedule'
import { requireEditorContent } from '../../utils/access'
import { auditMcp } from '../../utils/mcp/audit'
import { saveSchedule } from '../../utils/schedule'

export default defineMcpTool({
  name: 'schedules_migrate',
  description: 'One-off: turn place hours text and imported venue hours into schedules. Recognised place text keeps the place facts-check date; text it cannot read is stored with needsCheck and the text as note. Venue hours keep the venue facts-check date; OSM-only venues stay unverified. Existing schedules are never overwritten. dryRun (default true) only reports.',
  inputSchema: {
    dryRun: z.boolean().default(true),
  },
  handler: async ({ dryRun }) => {
    requireEditorContent('migrate schedules')
    const { placeRows, venueRows, existing } = await db.schedules.migrationSources()
    const report = { places: 0, venues: 0, flagged: [] as string[], skipped: 0 }
    for (const place of placeRows) {
      const text = place.hours?.trim()
      if (!text || existing.has(`place:${place.id}`)) {
        report.skipped += text ? 1 : 0
        continue
      }
      const parsed = rulesFromText(text)
      const rules = parsed ?? scheduleRulesSchema.parse({ note: text.slice(0, 200), needsCheck: true })
      if (!parsed) {
        report.flagged.push(place.slug)
      }
      report.places += 1
      if (!dryRun) {
        await saveSchedule('place', place.id, { rules, sourceUrl: null, verifiedAt: parsed && place.verifiedAt ? place.verifiedAt.slice(0, 10) : null }, { actor: 'migration' })
      }
    }
    for (const venue of venueRows) {
      if (existing.has(`venue:${venue.id}`)) {
        report.skipped += 1
        continue
      }
      const rules = rulesFromVenueHours(venue.hours)
      if (!rules) {
        continue
      }
      report.venues += 1
      if (!dryRun) {
        await saveSchedule('venue', venue.id, { rules, sourceUrl: null, verifiedAt: verifiedDate(venue.verifiedAt) }, { actor: 'migration' })
      }
    }
    if (!dryRun) {
      await auditMcp('schedules_migrate', 'schedule', null)
    }
    return { dryRun, ...report }
  },
})
