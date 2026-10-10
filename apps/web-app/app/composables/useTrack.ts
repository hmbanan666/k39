interface TrackInput {
  placeSlug?: string
  routeSlug?: string
  questSlug?: string
}

export function useTrack() {
  const consent = useConsent()

  async function track(type: string, extra: TrackInput = {}) {
    if (!consent.granted.value) {
      return
    }
    try {
      await $fetch('/api/events', {
        method: 'POST',
        body: {
          type,
          consent: true,
          ...extra,
        },
      })
    } catch {
      // Analytics must not break the page.
    }
  }

  return { track }
}
