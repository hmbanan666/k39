import { enabledOAuthProviders } from '../../utils/oauth'

export default defineEventHandler(() => {
  return { providers: enabledOAuthProviders() }
})
