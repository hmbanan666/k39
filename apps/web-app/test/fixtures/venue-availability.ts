/** Shared isolated data for the mounted regression and browser review. */
export function venueAvailabilityFixture() {
  return {
    type: 'listing',
    doc: {
      h1: 'Заведения',
      crumbs: [
        { name: 'Главная', path: '/' },
        { name: 'Заведения', path: '/zavedeniya' },
      ],
      description: 'Кафе и рестораны: адреса, часы работы и контакты.',
    },
    html: '',
    modules: [],
    heading: 'Заведения',
    regionSlug: 'fixture-town',
    kind: null,
    filters: {
      allTownsHref: '/zavedeniya',
      allKindsHref: '/zavedeniya/fixture-town',
      towns: [],
      kinds: [{ kind: 'coffee', href: '/zavedeniya/fixture-town/coffee', label: 'Кофейни' }],
    },
    items: [
      {
        slug: 'fixture-cafe-photo',
        name: 'Фикстура: кофейня у парка',
        kindLabel: 'Кофейня',
        latitude: 54.7,
        longitude: 20.5,
      },
      {
        slug: 'fixture-cafe-plain',
        name: 'Фикстура: кафе на площади',
        kindLabel: 'Кафе',
        latitude: 54.71,
        longitude: 20.51,
      },
      {
        slug: 'fixture-cafe-nocoords',
        name: 'Фикстура: кафе без координат',
        kindLabel: 'Кафе',
        latitude: null,
        longitude: null,
      },
    ].map((item) => ({
      ...item,
      href: `/zavedeniya/${item.slug}`,
      address: 'Калининград',
      cuisine: [],
      price: '',
      avgCheck: '',
      phone: null,
      stale: false,
      media: null,
      schedule: null,
      notices: [],
    })),
  }
}
