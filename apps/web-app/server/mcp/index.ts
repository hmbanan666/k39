import { requireContentToken } from '../utils/access'

export default defineMcpHandler({
  description: 'K39 content. The token can publish and edit live pages. No users or settings.',
  instructions: 'Write place pages in Russian using the content_guide resource. You may publish, unpublish, and edit published places, routes, collections, quests, hubs, and regions. region_upsert adds a region. quest_update can change routeSlug, or pass null, so content_archive can delete a draft route the quest no longer links. Routes take ordered points and collections take ordered items. content_archive deletes a draft route or collection and archives a published one. hub_update writes the hub markdown body and SEO fields. page_passport_set stores the page goal and action. content_score_get reads the score and its failing checks. Publish only sourced facts and licensed photos. Do not manage users, roles, or site settings.',
  middleware: (event) => {
    requireContentToken(event)
  },
})
