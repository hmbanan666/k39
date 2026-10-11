import process from 'node:process'
import { requireContentToken } from '../utils/access'
import { takeContentSlot } from './rate-limit'

export default defineMcpHandler({
  description: 'K39 content drafts. Publishing stays in /admin.',
  instructions: 'Write place pages in Russian using the content_guide resource. You may create and update drafts and submit them for review. You cannot set publicationStatus to published.',
  middleware: (event) => {
    requireContentToken(event)
    const token = process.env.CONTENT_API_TOKEN || ''
    takeContentSlot(token)
  },
})
