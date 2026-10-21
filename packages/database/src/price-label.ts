/**
 * A price written into a dish name or a size label.
 * ₽, or digits followed by руб, рублей, р, or Latin rub, rub., ruble, rubles.
 * A portion such as "250 мл" is not a price. "rubber" is not a price.
 */
const PRICE_IN_NAME = /₽|\d[\d\s]*(?:руб(?:\.|лей|ля|ль)?(?!\p{L})|р\.?(?!\p{L})|rub(?:les?)?\.?(?!\p{L}))/iu

export function priceInName(value: string) {
  return PRICE_IN_NAME.test(value)
}

export function priceInNameMessage() {
  return 'Цену пишите в поле цены, не в названии'
}
