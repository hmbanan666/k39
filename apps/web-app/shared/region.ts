export interface RegionDisplay {
  slug?: string | null
  title: string
  shortTitle?: string | null
}

// Catalogue anchors, not settlement or legal-boundary evidence (ADR 0051).
const ANCHORS: Record<string, [name: string, inside: string, of: string, by: string]> = {
  kaliningrad: ['Калининград', 'Калининграде', 'Калининграда', 'Калининграду'],
  svetlogorsk: ['Светлогорск', 'Светлогорске', 'Светлогорска', 'Светлогорску'],
  zelenogradsk: ['Зеленоградск', 'Зеленоградске', 'Зеленоградска', 'Зеленоградску'],
  yantarnyy: ['Янтарный', 'Янтарном', 'Янтарного', 'Янтарному'],
  baltiysk: ['Балтийск', 'Балтийске', 'Балтийска', 'Балтийску'],
  sovetsk: ['Советск', 'Советске', 'Советска', 'Советску'],
  pionerskiy: ['Пионерский', 'Пионерском', 'Пионерского', 'Пионерскому'],
  chernyakhovsk: ['Черняховск', 'Черняховске', 'Черняховска', 'Черняховску'],
  gusev: ['Гусев', 'Гусеве', 'Гусева', 'Гусеву'],
  gvardeysk: ['Гвардейск', 'Гвардейске', 'Гвардейска', 'Гвардейску'],
  guryevsk: ['Гурьевск', 'Гурьевске', 'Гурьевска', 'Гурьевску'],
  bagrationovsk: ['Багратионовск', 'Багратионовске', 'Багратионовска', 'Багратионовску'],
  mamonovo: ['Мамоново', 'Мамоново', 'Мамоново', 'Мамоново'],
  neman: ['Неман', 'Немане', 'Немана', 'Неману'],
  polessk: ['Полесск', 'Полесске', 'Полесска', 'Полесску'],
  pravdinsk: ['Правдинск', 'Правдинске', 'Правдинска', 'Правдинску'],
}

/** Shared display cases only. Never use these labels as addressLocality. */
export function regionArea(region: RegionDisplay | null | undefined) {
  const short = region?.shortTitle?.trim()
  const name = short || region?.title.trim() || ''
  const anchor = region?.slug && Object.hasOwn(ANCHORS, region.slug) ? ANCHORS[region.slug] : undefined
  if (anchor && (!short || short === anchor[0] || short === `${anchor[0]} и окрестности`)) {
    return {
      label: `${anchor[0]} и окрестности`,
      inside: `в ${anchor[1]} и окрестностях`,
      of: `${anchor[2]} и окрестностей`,
      by: `${anchor[3]} и окрестностям`,
    }
  }
  // Custom names are quoted as catalogue labels, without guessed declension.
  // Accept our own label as input too: readers may pass an already formatted name.
  const raw = name.replace(/^Территория «(.*)»$/, '$1')
  return {
    label: raw ? (/окрестност/iu.test(raw) ? raw : `Территория «${raw}»`) : '',
    inside: raw ? `на территории «${raw}»` : 'на этой территории',
    of: raw ? `территории «${raw}»` : 'этой территории',
    by: raw ? `территории «${raw}»` : 'этой территории',
  }
}

export function regionLabel(region: RegionDisplay | null | undefined) {
  return regionArea(region).label
}
