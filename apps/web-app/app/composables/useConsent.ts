export function useConsent() {
  const consent = useCookie<'granted' | 'denied' | null>('k39_consent', {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  const granted = computed(() => consent.value === 'granted')
  const decided = computed(() => consent.value === 'granted' || consent.value === 'denied')

  function grant() {
    consent.value = 'granted'
  }

  function deny() {
    consent.value = 'denied'
  }

  return { consent, granted, decided, grant, deny }
}
