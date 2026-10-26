// Single source for the operator. Name, INN, OGRNIP and city are printed
// only on the privacy policy, the terms and the consent document.
export const operator = {
  form: 'индивидуальный предприниматель',
  name: 'Косарев Николай Николаевич',
  inn: '110111889708',
  ogrnip: '319112100033557',
  address: 'г. Светлогорск',
  email: 'nick@kosarev.space',
} as const

export function operatorMailHref() {
  return `mailto:${operator.email}`
}

export function operatorIdLine() {
  return operator.ogrnip ? `ИНН ${operator.inn}, ОГРНИП ${operator.ogrnip}` : `ИНН ${operator.inn}`
}
