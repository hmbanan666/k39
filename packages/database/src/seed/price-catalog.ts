/**
 * Shared price catalog: the 32 production slugs.
 * Titles of the six rows from migration 0026 stay as stored there.
 * Categories match `PRICE_CATEGORY_ICONS`. This is catalog data, not a page.
 */
export interface PriceCatalogItem {
  slug: string
  title: string
  category: string
  defaultVariant: string | null
  sortOrder: number
}

export const PRICE_CATALOG: PriceCatalogItem[] = [
  { slug: 'cappuccino', title: 'Капучино', category: 'coffee', defaultVariant: '300 мл', sortOrder: 10 },
  { slug: 'americano', title: 'Американо', category: 'coffee', defaultVariant: '300 мл', sortOrder: 20 },
  { slug: 'margherita', title: 'Пицца «Маргарита»', category: 'pizza', defaultVariant: '30 см', sortOrder: 30 },
  { slug: 'philadelphia', title: 'Ролл «Филадельфия»', category: 'sushi', defaultVariant: '8 шт.', sortOrder: 40 },
  { slug: 'borscht', title: 'Борщ', category: 'soup', defaultVariant: 'порция', sortOrder: 50 },
  { slug: 'burger', title: 'Бургер', category: 'burger', defaultVariant: 'классический', sortOrder: 60 },
  { slug: 'espresso', title: 'Эспрессо', category: 'coffee', defaultVariant: null, sortOrder: 70 },
  { slug: 'latte', title: 'Латте', category: 'coffee', defaultVariant: null, sortOrder: 80 },
  { slug: 'raf', title: 'Раф', category: 'coffee', defaultVariant: null, sortOrder: 90 },
  { slug: 'beer', title: 'Пиво', category: 'beer', defaultVariant: null, sortOrder: 100 },
  { slug: 'lemonade', title: 'Лимонад', category: 'drinks', defaultVariant: null, sortOrder: 110 },
  { slug: 'mors', title: 'Морс', category: 'drinks', defaultVariant: null, sortOrder: 120 },
  { slug: 'mulled-wine', title: 'Глинтвейн', category: 'drinks', defaultVariant: null, sortOrder: 130 },
  { slug: 'orange-juice', title: 'Апельсиновый сок', category: 'drinks', defaultVariant: null, sortOrder: 140 },
  { slug: 'tea-lemon', title: 'Чай с лимоном', category: 'tea', defaultVariant: null, sortOrder: 150 },
  { slug: 'bliny', title: 'Блины', category: 'breakfast', defaultVariant: null, sortOrder: 160 },
  { slug: 'croissant', title: 'Круассан', category: 'bakery', defaultVariant: null, sortOrder: 170 },
  { slug: 'syrniki', title: 'Сырники', category: 'breakfast', defaultVariant: null, sortOrder: 180 },
  { slug: 'carbonara', title: 'Карбонара', category: 'pasta', defaultVariant: null, sortOrder: 190 },
  { slug: 'draniki', title: 'Драники', category: 'main', defaultVariant: null, sortOrder: 200 },
  { slug: 'klopsy', title: 'Клопсы', category: 'main', defaultVariant: null, sortOrder: 210 },
  { slug: 'pelmeni', title: 'Пельмени', category: 'main', defaultVariant: null, sortOrder: 220 },
  { slug: 'salmon-steak', title: 'Стейк из лосося', category: 'fish', defaultVariant: null, sortOrder: 230 },
  { slug: 'shawarma', title: 'Шаурма', category: 'street-food', defaultVariant: null, sortOrder: 240 },
  { slug: 'smoked-fish', title: 'Копчёная рыба', category: 'fish', defaultVariant: null, sortOrder: 250 },
  { slug: 'pepperoni', title: 'Пепперони', category: 'pizza', defaultVariant: null, sortOrder: 260 },
  { slug: 'ramen', title: 'Рамен', category: 'soup', defaultVariant: null, sortOrder: 270 },
  { slug: 'tom-yum', title: 'Том ям', category: 'soup', defaultVariant: null, sortOrder: 280 },
  { slug: 'ukha', title: 'Уха', category: 'soup', defaultVariant: null, sortOrder: 290 },
  { slug: 'business-lunch', title: 'Бизнес-ланч', category: 'lunch', defaultVariant: null, sortOrder: 300 },
  { slug: 'caesar', title: 'Цезарь', category: 'salad', defaultVariant: null, sortOrder: 310 },
  { slug: 'cheesecake', title: 'Чизкейк', category: 'dessert', defaultVariant: null, sortOrder: 320 },
]
