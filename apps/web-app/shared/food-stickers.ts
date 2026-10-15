// Food stickers for price-anchor cards. Catalog for people and agents: docs/food-stickers.md.
// Files live in public/stickers/food/{slug}-{width}.{avif|webp} and {slug}-256.png.
// Slugs equal price catalog slugs (PRICE_ITEM_ICONS in shared/price-compare.ts).

export const FOOD_STICKER_WIDTHS = [128, 256, 512] as const

export interface FoodStickerMeta {
  /** Russian catalog name. */
  name: string
  /** Russian alt text. */
  alt: string
  /** What the picture shows, in English. */
  scene: string
  group: string
  /** Intrinsic size of the 512 px variant. */
  width: number
  height: number
}

export const FOOD_STICKERS = {
  'americano': {
    name: 'Американо',
    alt: 'Американо в белой кружке',
    scene: 'White speckled mug of black coffee.',
    group: 'coffee',
    width: 512,
    height: 475,
  },
  'beer': {
    name: 'Пиво',
    alt: 'Бокал светлого пива с пеной',
    scene: 'Tall pint glass of lager with a foam head.',
    group: 'drinks',
    width: 512,
    height: 832,
  },
  'bliny': {
    name: 'Блины',
    alt: 'Стопка блинов со сметаной',
    scene: 'Stack of thin pancakes on a plate with a dollop of sour cream.',
    group: 'breakfast',
    width: 512,
    height: 386,
  },
  'borscht': {
    name: 'Борщ',
    alt: 'Тарелка борща со сметаной',
    scene: 'Clay bowl of red borscht with sour cream.',
    group: 'soups',
    width: 512,
    height: 467,
  },
  'burger': {
    name: 'Бургер',
    alt: 'Бургер с котлетой и овощами',
    scene: 'Beef burger with cheese, lettuce, tomato and onion.',
    group: 'mains',
    width: 512,
    height: 490,
  },
  'business-lunch': {
    name: 'Бизнес-ланч',
    alt: 'Бизнес-ланч на подносе с отделениями',
    scene: 'Divided tray: soup, salad, main with garnish.',
    group: 'lunch',
    width: 512,
    height: 387,
  },
  'caesar': {
    name: 'Цезарь',
    alt: 'Салат Цезарь с курицей и сухариками',
    scene: 'Bowl of Caesar salad with croutons and parmesan.',
    group: 'salads',
    width: 512,
    height: 446,
  },
  'cappuccino': {
    name: 'Капучино',
    alt: 'Капучино с латте-артом на блюдце',
    scene: 'Cup of cappuccino with latte-art foam on a saucer.',
    group: 'coffee',
    width: 512,
    height: 517,
  },
  'carbonara': {
    name: 'Карбонара',
    alt: 'Паста карбонара на тарелке',
    scene: 'Plate of spaghetti carbonara with bacon.',
    group: 'mains',
    width: 512,
    height: 372,
  },
  'cheesecake': {
    name: 'Чизкейк',
    alt: 'Кусок чизкейка с ягодами',
    scene: 'Slice of cheesecake with berry topping.',
    group: 'desserts',
    width: 512,
    height: 432,
  },
  'croissant': {
    name: 'Круассан',
    alt: 'Круассан',
    scene: 'Golden butter croissant.',
    group: 'breakfast',
    width: 512,
    height: 392,
  },
  'draniki': {
    name: 'Драники',
    alt: 'Драники со сметаной',
    scene: 'Stack of potato pancakes with sour cream.',
    group: 'mains',
    width: 512,
    height: 399,
  },
  'espresso': {
    name: 'Эспрессо',
    alt: 'Чашка эспрессо на блюдце',
    scene: 'Small cup of espresso on a saucer.',
    group: 'coffee',
    width: 512,
    height: 438,
  },
  'klopsy': {
    name: 'Клопсы',
    alt: 'Кёнигсбергские клопсы в белом соусе',
    scene: 'Königsberg meatballs in white caper sauce.',
    group: 'local',
    width: 512,
    height: 366,
  },
  'latte': {
    name: 'Латте',
    alt: 'Латте в высоком стакане',
    scene: 'Tall glass of layered latte with a heart in the foam.',
    group: 'coffee',
    width: 512,
    height: 731,
  },
  'lemonade': {
    name: 'Лимонад',
    alt: 'Стакан лимонада с лимоном и мятой',
    scene: 'Glass of lemonade with a lemon slice and mint.',
    group: 'drinks',
    width: 512,
    height: 708,
  },
  'margherita': {
    name: 'Маргарита',
    alt: 'Пицца Маргарита',
    scene: 'Whole margherita pizza with basil.',
    group: 'pizza',
    width: 512,
    height: 433,
  },
  'mors': {
    name: 'Морс',
    alt: 'Стакан ягодного морса со льдом',
    scene: 'Tall glass of red berry mors with ice.',
    group: 'drinks',
    width: 512,
    height: 784,
  },
  'mulled-wine': {
    name: 'Глинтвейн',
    alt: 'Кружка глинтвейна с апельсином и корицей',
    scene: 'Steaming glass mug of mulled wine, orange slice, cinnamon.',
    group: 'drinks',
    width: 512,
    height: 573,
  },
  'orange-juice': {
    name: 'Апельсиновый сок',
    alt: 'Стакан апельсинового сока со льдом',
    scene: 'Glass of orange juice with ice.',
    group: 'drinks',
    width: 512,
    height: 710,
  },
  'pelmeni': {
    name: 'Пельмени',
    alt: 'Миска пельменей со сметаной',
    scene: 'Bowl of pelmeni dumplings with sour cream.',
    group: 'mains',
    width: 512,
    height: 430,
  },
  'pepperoni': {
    name: 'Пепперони',
    alt: 'Пицца Пепперони',
    scene: 'Whole pepperoni pizza.',
    group: 'pizza',
    width: 512,
    height: 389,
  },
  'philadelphia': {
    name: 'Филадельфия',
    alt: 'Роллы Филадельфия с лососем',
    scene: 'Philadelphia rolls topped with salmon on a wooden board.',
    group: 'sushi',
    width: 512,
    height: 397,
  },
  'raf': {
    name: 'Раф',
    alt: 'Раф в высоком стакане',
    scene: 'Tall glass of creamy raf coffee.',
    group: 'coffee',
    width: 512,
    height: 697,
  },
  'ramen': {
    name: 'Рамен',
    alt: 'Миска рамена с яйцом',
    scene: 'Bowl of ramen with egg, nori and spring onion.',
    group: 'soups',
    width: 512,
    height: 482,
  },
  'salmon-steak': {
    name: 'Стейк из лосося',
    alt: 'Стейк из лосося с лимоном',
    scene: 'Grilled salmon steak with lemon on a plate.',
    group: 'mains',
    width: 512,
    height: 378,
  },
  'shawarma': {
    name: 'Шаурма',
    alt: 'Шаурма в лаваше',
    scene: 'Shawarma wrap in paper.',
    group: 'street food',
    width: 512,
    height: 541,
  },
  'smoked-fish': {
    name: 'Копчёная рыба',
    alt: 'Копчёная рыба на бумаге',
    scene: 'Smoked fish on paper.',
    group: 'local',
    width: 512,
    height: 437,
  },
  'syrniki': {
    name: 'Сырники',
    alt: 'Сырники со сметаной',
    scene: 'Plate of syrniki with sour cream.',
    group: 'breakfast',
    width: 512,
    height: 389,
  },
  'tea-lemon': {
    name: 'Чай с лимоном',
    alt: 'Чашка чая с лимоном',
    scene: 'Cup of black tea with a lemon slice.',
    group: 'drinks',
    width: 512,
    height: 441,
  },
  'tom-yum': {
    name: 'Том ям',
    alt: 'Миска том яма с креветками',
    scene: 'Bowl of tom yum with shrimp and mushrooms.',
    group: 'soups',
    width: 512,
    height: 546,
  },
  'ukha': {
    name: 'Уха',
    alt: 'Тарелка ухи с рыбой',
    scene: 'Bowl of fish soup with a fish piece and vegetables.',
    group: 'soups',
    width: 512,
    height: 463,
  },
} as const satisfies Record<string, FoodStickerMeta>

export type FoodStickerSlug = keyof typeof FOOD_STICKERS

export function isFoodStickerSlug(slug: string): slug is FoodStickerSlug {
  return Object.hasOwn(FOOD_STICKERS, slug)
}

export function foodStickerSrc(slug: FoodStickerSlug, width: number, format: 'avif' | 'webp' | 'png') {
  return `/stickers/food/${slug}-${width}.${format}`
}

export function foodStickerSrcset(slug: FoodStickerSlug, format: 'avif' | 'webp') {
  return FOOD_STICKER_WIDTHS.map((w) => `${foodStickerSrc(slug, w, format)} ${w}w`).join(', ')
}
