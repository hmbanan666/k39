// Single source for the operator. Leave ogrnip empty until it is known.
export const operator = {
  form: 'индивидуальный предприниматель',
  name: 'Косарев Николай Николаевич',
  inn: '110111889708',
  ogrnip: '',
  address: 'г. Светлогорск',
  email: 'nick@kosarev.space',
} as const

export function operatorMailHref() {
  return `mailto:${operator.email}`
}
