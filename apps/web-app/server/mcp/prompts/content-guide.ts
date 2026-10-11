import { contentGuideMessages } from '../guide'

export default defineMcpPrompt({
  name: 'content_guide',
  description: 'Instructions for drafting a K39 place page in Russian without inventing facts.',
  handler: async () => contentGuideMessages(),
})
