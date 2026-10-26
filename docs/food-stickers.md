# Food stickers

32 generated food stickers for the «Ориентиры цен» price-anchor cards. They live in `apps/web-app/public/stickers/food/`, apart from the moose stickers (`docs/stickers.md`). The typed catalog is `apps/web-app/shared/food-stickers.ts`.

## Usage rules

- Use them only as icons of standard price catalog items: price-anchor cards and places that show a catalog item's price. One sticker per item.
- They are our generated illustrations in the K39 sticker style (white outline, transparent background). Never present one as a photo of a venue's real dish, never use one in «Что заказать» (the business uploads real photos there), and never put one next to a guest photo as if it were that dish.
- The moose rules (at most two per page, no stickers in cards) do not apply here: food stickers are item icons, not mascot art.
- Alt text comes from the catalog. When the card already prints the item name, render the sticker `decorative` (empty alt).
- Typical size is 48 to 128 CSS px wide. On a price card and on the `/ceny` title the sticker sits in a fixed 56×56 px box (`object-fit: contain`, overflow hidden). Do not size that box by the file width: trimmed stickers do not share an aspect ratio, and a tall glass then covers the title. Do not stretch beyond 512 px.
- Resolution for a catalog item: `price_items.image` when it is set, otherwise this sticker when `isFoodStickerSlug(slug)`, otherwise the Tabler icon from `PRICE_ITEM_ICONS`, then `PRICE_CATEGORY_ICONS`.

## Component

`<Sticker set="food">` uses the same `<picture>` as the moose (`docs/stickers.md`): AVIF and WebP srcset at 128, 256 and 512, PNG fallback at 256, and `sizes` equal to the `width` prop. Omit `set` for the moose. Do not point a card at one file under `public/stickers/food/` on its own.

```vue
<Sticker set="food" slug="cappuccino" :width="56" decorative />
```

## Files

- `food/{slug}-{128|256|512}.avif`, `food/{slug}-{128|256|512}.webp`, `food/{slug}-256.png`. Slug equals the price catalog slug.
- Sources: images generated in packs of 8 on a green background, cut out by Nick, upscaled 4x with Real-ESRGAN x4plus anime 6B. Then processed like the moose: alpha box trimmed, uniform 3% transparent padding, Lanczos resize, AVIF quality 60, WebP quality 82.
- To add one: generate in the same style, process the same way, use the catalog slug as file name, add an entry to `shared/food-stickers.ts` and a row here.

## Catalog

Sorted by slug. Name and alt are Russian (UI copy); the rest is English.

| Slug (catalog item) | Name (RU)        | Alt (RU)                                 | What it shows                                                  | Group       | 512 px size |
| ------------------- | ---------------- | ---------------------------------------- | -------------------------------------------------------------- | ----------- | ----------- |
| `americano`         | Американо        | Американо в белой кружке                 | White speckled mug of black coffee.                            | coffee      | 512×475     |
| `beer`              | Пиво             | Бокал светлого пива с пеной              | Tall pint glass of lager with a foam head.                     | drinks      | 512×832     |
| `bliny`             | Блины            | Стопка блинов со сметаной                | Stack of thin pancakes on a plate with a dollop of sour cream. | breakfast   | 512×386     |
| `borscht`           | Борщ             | Тарелка борща со сметаной                | Clay bowl of red borscht with sour cream.                      | soups       | 512×467     |
| `burger`            | Бургер           | Бургер с котлетой и овощами              | Beef burger with cheese, lettuce, tomato and onion.            | mains       | 512×490     |
| `business-lunch`    | Бизнес-ланч      | Бизнес-ланч на подносе с отделениями     | Divided tray: soup, salad, main with garnish.                  | lunch       | 512×387     |
| `caesar`            | Цезарь           | Салат Цезарь с курицей и сухариками      | Bowl of Caesar salad with croutons and parmesan.               | salads      | 512×446     |
| `cappuccino`        | Капучино         | Капучино с латте-артом на блюдце         | Cup of cappuccino with latte-art foam on a saucer.             | coffee      | 512×517     |
| `carbonara`         | Карбонара        | Паста карбонара на тарелке               | Plate of spaghetti carbonara with bacon.                       | mains       | 512×372     |
| `cheesecake`        | Чизкейк          | Кусок чизкейка с ягодами                 | Slice of cheesecake with berry topping.                        | desserts    | 512×432     |
| `croissant`         | Круассан         | Круассан                                 | Golden butter croissant.                                       | breakfast   | 512×392     |
| `draniki`           | Драники          | Драники со сметаной                      | Stack of potato pancakes with sour cream.                      | mains       | 512×399     |
| `espresso`          | Эспрессо         | Чашка эспрессо на блюдце                 | Small cup of espresso on a saucer.                             | coffee      | 512×438     |
| `klopsy`            | Клопсы           | Кёнигсбергские клопсы в белом соусе      | Königsberg meatballs in white caper sauce.                     | local       | 512×366     |
| `latte`             | Латте            | Латте в высоком стакане                  | Tall glass of layered latte with a heart in the foam.          | coffee      | 512×731     |
| `lemonade`          | Лимонад          | Стакан лимонада с лимоном и мятой        | Glass of lemonade with a lemon slice and mint.                 | drinks      | 512×708     |
| `margherita`        | Маргарита        | Пицца Маргарита                          | Whole margherita pizza with basil.                             | pizza       | 512×433     |
| `mors`              | Морс             | Стакан ягодного морса со льдом           | Tall glass of red berry mors with ice.                         | drinks      | 512×784     |
| `mulled-wine`       | Глинтвейн        | Кружка глинтвейна с апельсином и корицей | Steaming glass mug of mulled wine, orange slice, cinnamon.     | drinks      | 512×573     |
| `orange-juice`      | Апельсиновый сок | Стакан апельсинового сока со льдом       | Glass of orange juice with ice.                                | drinks      | 512×710     |
| `pelmeni`           | Пельмени         | Миска пельменей со сметаной              | Bowl of pelmeni dumplings with sour cream.                     | mains       | 512×430     |
| `pepperoni`         | Пепперони        | Пицца Пепперони                          | Whole pepperoni pizza.                                         | pizza       | 512×389     |
| `philadelphia`      | Филадельфия      | Роллы Филадельфия с лососем              | Philadelphia rolls topped with salmon on a wooden board.       | sushi       | 512×397     |
| `raf`               | Раф              | Раф в высоком стакане                    | Tall glass of creamy raf coffee.                               | coffee      | 512×697     |
| `ramen`             | Рамен            | Миска рамена с яйцом                     | Bowl of ramen with egg, nori and spring onion.                 | soups       | 512×482     |
| `salmon-steak`      | Стейк из лосося  | Стейк из лосося с лимоном                | Grilled salmon steak with lemon on a plate.                    | mains       | 512×378     |
| `shawarma`          | Шаурма           | Шаурма в лаваше                          | Shawarma wrap in paper.                                        | street food | 512×541     |
| `smoked-fish`       | Копчёная рыба    | Копчёная рыба на бумаге                  | Smoked fish on paper.                                          | local       | 512×437     |
| `syrniki`           | Сырники          | Сырники со сметаной                      | Plate of syrniki with sour cream.                              | breakfast   | 512×389     |
| `tea-lemon`         | Чай с лимоном    | Чашка чая с лимоном                      | Cup of black tea with a lemon slice.                           | drinks      | 512×441     |
| `tom-yum`           | Том ям           | Миска том яма с креветками               | Bowl of tom yum with shrimp and mushrooms.                     | soups       | 512×546     |
| `ukha`              | Уха              | Тарелка ухи с рыбой                      | Bowl of fish soup with a fish piece and vegetables.            | soups       | 512×463     |
