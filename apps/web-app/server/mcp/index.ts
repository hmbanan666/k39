import { requireContentToken } from '../utils/access'

export default defineMcpHandler({
  description: 'K39 content. The token can publish and edit live pages. No users or settings.',
  instructions: 'Write place pages in Russian using the content_guide resource. You may publish, unpublish, and edit published places, routes, collections, quests, and hubs. Publish only sourced facts and licensed photos. Do not manage users, roles, or site settings.',
  middleware: (event) => {
    requireContentToken(event)
  },
})
