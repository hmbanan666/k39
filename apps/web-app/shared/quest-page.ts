export interface QuestStepSource {
  slug: string
  title: string
  prompt?: string | null
  categorySlug?: string | null
}

export interface QuestStepCard {
  href: string
  title: string
  task: string
  label: string
  kind: string
}

export function questStepCards(steps: QuestStepSource[]): QuestStepCard[] {
  return steps.map((step, index) => ({
    href: `/${step.slug}`,
    title: step.title,
    task: step.prompt?.trim() ?? '',
    label: `Шаг ${index + 1}`,
    kind: step.categorySlug || '',
  }))
}

export function questRoutePath(slug: string | null | undefined) {
  const value = slug?.trim()
  return value ? `/marshruty/${value}` : null
}
