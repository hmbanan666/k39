export type OAuthProviderName = 'yandex' | 'vk'

export function enabledOAuthProviders(): OAuthProviderName[] {
  const config = useRuntimeConfig()
  const providers: OAuthProviderName[] = []
  if (config.oauth?.yandex?.clientId && config.oauth?.yandex?.clientSecret) {
    providers.push('yandex')
  }
  if (config.oauth?.vk?.clientId && config.oauth?.vk?.clientSecret) {
    providers.push('vk')
  }
  return providers
}

export function assertOAuthProvider(provider: string): asserts provider is OAuthProviderName {
  if (!enabledOAuthProviders().includes(provider as OAuthProviderName)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Login is disabled',
    })
  }
}
