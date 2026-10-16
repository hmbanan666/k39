# Mascot stickers

The K39 moose is a cartoon mascot. 68 stickers live in `apps/web-app/public/stickers/`. The typed catalog is `apps/web-app/shared/stickers.ts`; the component is `<Sticker>`. Food stickers for price-anchor cards are a separate set in `public/stickers/food/`, see `docs/food-stickers.md`.

## Usage rules

- At most two stickers on one page. One is the norm. Zero is fine. A sticker that belongs to a venue module is part of that module and is outside this count.
- A sticker must say something about the task or the moment: an empty state, an error, a success, a season, the topic of the section. Never use one as decoration or filler.
- Modals and dialogs may carry one sticker (sign-in, success, quest reward).
- Never put a sticker inside place cards, lists, maps, or next to photos of real places. Never cover content or push the main answer below the fold.
- Match the season: do not show the beach moose in a January guide or the snowman in July.
- Do not repeat the same sticker twice on one page. Prefer different stickers on neighbouring pages of one section.
- Alt text comes from the catalog. Pass `decorative` only when the text next to the sticker already says the same thing; the image then gets an empty alt.
- Typical size is 96 to 200 CSS px wide. Do not stretch beyond 512 px.

## Component

```vue
<Sticker slug="with-map" :width="160" />

<Sticker slug="shocked" :width="120" decorative />

<Sticker slug="postman-hi" :width="140" priority />

<Sticker set="food" slug="cappuccino" :width="56" decorative />
```

`<picture>` with AVIF and WebP sources at 128, 256 and 512 px (`sizes` equals the given width), PNG fallback at 256 px. Lazy loading by default; `priority` makes it eager. Omit `set` for the moose. `set="food"` uses the price-catalog stickers in `docs/food-stickers.md` and the same markup.

## Files

- `{slug}-{128|256|512}.avif`, `{slug}-{128|256|512}.webp`, `{slug}-256.png`.
- Sources are Nick's originals (about 900 to 1500 px, transparent). The alpha box is trimmed and a uniform 3% transparent padding is added, so all stickers sit the same way. Resized with Lanczos, no upscaling needed. AVIF quality 60, WebP quality 82.
- To add a sticker: process the same way, add an entry to `shared/stickers.ts`, and describe it here.

## Catalog

Sorted by slug. `Alt` and `When to use` are Russian (UI copy); the rest is English. `Category` is the coarse group (`STICKER_CATEGORY` in `shared/stickers.ts`). Search by category, then by theme.

| Slug | Category | Alt (RU) | When to use (RU) | What the moose does | Mood | Page types | Themes | Seasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `amber` | place | Лось держит большой светящийся кусок янтаря | Янтарь, музеи, сувениры, Янтарный. | Holds a big glowing raw amber nugget in both hands, proud smile. | proud | place, hub, collection, longread | amber, museums, souvenirs, Yantarny | all |
| `builder-with-wrench` | status | Лось в строительной каске с гаечным ключом | Технические работы, в разработке, ремонт, раздел скоро. | Yellow hard hat, holds a wrench. | busy | error, empty-state, admin | maintenance, under construction, coming soon, repairs | all |
| `captain-at-helm` | coast | Лось в капитанской фуражке за штурвалом | Морские прогулки, порты, флот, Балтийск. | Captain cap, stands behind a ship wheel. | confident | place, route, hub, longread | sea, boats, ports, navy, Baltiysk | all |
| `cook-with-pan` | food | Лось в поварском колпаке со сковородой овощей | Еда, рестораны, рецепты, местная кухня. | Chef hat, holds a frying pan with sizzling vegetables. | busy, happy | venue, venue-listing, hub, longread | food, restaurants, recipes, local cuisine | all |
| `detective` | history | Лось в кепке с лупой разглядывает древнюю амфору | История и археология, квесты, «ничего не найдено» в поиске. | Flat cap and magnifying glass, inspects an ancient amphora. | curious | place, longread, quest, search | history, archaeology, museums, quests, mysteries, not found | all |
| `fishing` | nature | Лось с удочкой, на крючке рыбка | Рыбалка, заливы и озёра, неспешный день. | Holds a fishing rod with a small fish on the line. | cheerful, patient | place, route, month-guide | fishing, lagoons, lakes, rivers, slow day | spring, summer, autumn |
| `hungry` | food | Лось с вилкой, ножом и салфеткой ждёт еду | Где поесть, пустой список заведений, перерыв на обед. | Napkin tucked in, fork and knife in hands, waiting for food. | hungry, eager | venue-listing, hub, route | where to eat, lunch stop, food | all |
| `ice-skating` | season | Лось катается на коньках | Катки, зимние развлечения, активный отдых. | Glides on white ice skates, arms spread. | joyful | month-guide, venue-listing, hub | skating rinks, winter, sport | winter |
| `in-winter-hat-and-scarf` | season | Лось в красной вязаной шапке и шарфе | Холодная погода, зимние гиды, Новый год. | Red knitted hat with a pompom and snowflake scarf. | cozy | month-guide, hub, modal | winter, cold weather, New Year, holidays | winter |
| `jumping-with-confetti` | celebration | Лось радостно прыгает среди конфетти | Успех, поздравление, квест пройден, праздник. | Jumps with arms up among colorful confetti. | overjoyed | modal, quest, month-guide | success, celebration, festivals, events | all |
| `kicking-ball` | sport | Лось бьёт по футбольному мячу | Спорт, стадионы, матчи, активный отдых. | Kicks a soccer ball mid-run. | sporty | place, venue-listing, month-guide | football, sport, stadium, kids | spring, summer, autumn |
| `knight` | history | Лось в рыцарских доспехах с мечом у замковой башни | Замки, форты, Тевтонский орден, детские квесты. | Knight armor and visor, wooden sword, stands by a castle tower. | brave, playful | place, hub, collection, quest | castles, forts, Teutonic Order, kids, quests | all |
| `laughing` | greeting | Лось смеётся, зажмурившись | Шутки, весёлые факты, лёгкое настроение. | Laughs with eyes shut, hands on belly. | amused | longread, modal, about | fun facts, humor, kids | all |
| `on-sled` | season | Лось сидит на деревянных санках | Зимние развлечения, горки, каникулы. | Sits on a wooden sled, ready to slide. | joyful | month-guide, hub, collection | winter, sledding, kids, holidays | winter |
| `photographer` | travel | Лось в кепке фотографирует | Видовые точки, фотоместа, загрузка медиа. | Flat cap, takes a photo with a big camera. | focused | place, route, collection, longread | viewpoints, photo spots, architecture, media upload | all |
| `pointing-right` | hint | Лось показывает пальцем вправо | Подсказка, указание на кнопку или блок, онбординг. | Points to the right with a smile. | helpful | empty-state, modal, home, auth | hints, onboarding, call to action | all |
| `postman` | greeting | Лось-почтальон в жёлтом шарфе с сумкой | Почта, открытки, подписки, сообщение об успехе. | Yellow scarf and blue mail bag, stands and smiles. | friendly, calm | about, modal, auth | mail, postcards, subscriptions, success messages | all |
| `postman-hi` | greeting | Лось-почтальон в жёлтом шарфе машет рукой | Приветствие, вход, рассылка, контакты. | Yellow scarf and blue mail bag, waves hello. | friendly | home, about, auth, modal | greeting, sign-in, newsletter, contacts, welcome | all |
| `running-with-map` | travel | Лось с рюкзаком бежит с картой | Начать маршрут, отправиться в путь, планирование поездки. | Runs with a green backpack, holding a paper map. | energetic | route, hub, map | travel, routes, hiking, trip start | all |
| `running-with-stopwatch` | status | Лось бежит с секундомером | Загрузка, ожидание, ограниченное по времени предложение, быстрые маршруты. | Runs holding a stopwatch. | hurried | loading, modal, route | loading, time-limited offers, quick trips, deadlines | all |
| `sad-with-broken-cable` | status | Грустный лось держит порванный кабель | Ошибка сети или сервера, нет соединения, что-то сломалось. | Sad face, holds a snapped cable. | sad | error, modal, empty-state | errors, offline, server error, 500 | all |
| `shocked` | status | Удивлённый лось, вокруг молнии | Ошибки, 404, предупреждения, удивительные факты. | Open-mouthed surprise with lightning bolts around. | shocked | error, modal, longread | errors, 404, surprising facts, warnings, storms | all |
| `shrugging` | status | Лось разводит руками | Ничего не найдено, нет данных, неизвестно. | Shrugs with both hands out, smiling. | puzzled | empty-state, search, error | not found, no results, no data | all |
| `sleeping` | status | Лось спит, свернувшись, рядом месяц | Ночь, закрыто сейчас, нет активности, тихий режим. | Sleeps curled up, crescent moon above. | sleepy | empty-state, venue, modal | night, closed now, hotels, rest, no activity | all |
| `sunbathing` | coast | Лось загорает на полосатом полотенце под зонтом | Пляжи, отдых, курорты, выходные летом. | Lies on a striped towel under a beach umbrella, relaxed. | lazy, relaxed | hub, month-guide, collection | beaches, rest, resorts, weekend | summer |
| `swimming` | coast | Лось в очках для плавания в розовом круге на воде | Купание, море, озёра, аквапарки. | Swim goggles, floats in a pink rubber ring. | joyful | hub, month-guide, place | swimming, sea, lakes, water parks, kids | summer |
| `tourist-with-shell` | coast | Лось в тёмных очках и гавайской рубашке с рюкзаком и ракушкой | Приезд на море, пляжный отдых, летние подборки. | Tourist in sunglasses and a blue Hawaiian shirt, backpack on, shows a scallop shell. | cheerful | hub, month-guide, route, collection | beaches, resorts, seaside holiday, arrival | summer |
| `with-alarm-clock` | time | Лось держит будильник | Часы работы, напоминание, скоро начало, время. | Holds a classic twin-bell alarm clock. | alert | venue, modal, event | opening hours, reminders, timing, early start | all |
| `with-amber-chest` | history | Лось открывает сундук с янтарём | Награда за квест, сокровища, скрытые места. | Opens a wooden treasure chest full of glowing amber. | delighted | quest, collection, modal | treasure, rewards, quests, amber, hidden gems | all |
| `with-backpack-and-stick` | travel | Лось с большим рюкзаком и посохом | Походы, тропы, экотропы, нацпарк. | Big hiking backpack and walking stick, ready to go. | adventurous | route, hub, month-guide | hiking, trails, nature, eco paths, national park | spring, summer, autumn |
| `with-bicycle` | travel | Лось едет на велосипеде с корзинкой | Велосипедные маршруты, променады, побережье. | Rides a blue bicycle with a wicker basket. | cheerful | route, place, month-guide | cycling, bike routes, promenades, coast | spring, summer, autumn |
| `with-binoculars` | travel | Лось смотрит в бинокль | Поиск, обзорные точки, наблюдение за птицами. | Looks through big binoculars. | curious | search, place, route | search, viewpoints, birdwatching, exploring | all |
| `with-blank-sign` | hint | Лось держит пустую деревянную табличку | Объявление, указатель, анонс, место под подпись. | Holds a blank wooden signpost. | friendly | empty-state, modal, home | announcements, signposts, notices | all |
| `with-blossom-branch` | season | Лось с цветущей веткой и бабочками | Весна, цветение, парки, сакура. | Holds a cherry blossom branch with blue butterflies. | dreamy | month-guide, place, hub | spring, blossom, parks, gardens | spring |
| `with-book` | history | Лось читает раскрытую книгу | Лонгриды, библиотеки, история, путеводитель. | Reads an open blue book. | focused | longread, place, about | reading, libraries, history, guides, Kant | all |
| `with-bouquet` | celebration | Лось держит букет цветов | Поздравление, благодарность, праздник, 8 Марта. | Holds a bouquet of bright flowers. | sweet | modal, month-guide, about | thanks, congratulations, holidays, dates | all |
| `with-calendar` | time | Лось держит календарь | Афиша, события, расписание, планирование дат. | Holds a big wall calendar. | organized | month-guide, event, hub | events, schedule, dates, planning | all |
| `with-cocoa-in-blanket` | food | Лось в пледе с кружкой какао | Уют, холод, дождливый день, кафе. | Wrapped in a blanket, holds a mug of cocoa with marshmallows. | cozy | month-guide, venue-listing, hub | cozy, cold weather, cafes, rainy day | autumn, winter |
| `with-coffee-and-croissant` | food | Лось с чашкой кофе и круассаном | Кофейни, завтраки, утро. | Cup of coffee and a croissant. | cozy | venue, venue-listing, route | coffee, breakfast, cafes, morning | all |
| `with-coin-wallet` | offer | Лось держит кошелёк с монетами | Цены, оплата, бюджет, бесплатно или дёшево. | Holds an open wallet full of gold coins. | pleased | venue, modal, collection | prices, payment, budget, free, offers | all |
| `with-gift` | offer | Лось держит подарочную коробку | Подарок, бонус, акция, промокод, праздник. | Holds a gift box with a red bow. | generous | modal, quest, home | gifts, bonuses, offers, promo codes, holidays | all |
| `with-heart` | greeting | Лось обнимает большое красное сердце | Избранное, благодарность, сохранённые места. | Hugs a big red heart. | warm | modal, auth, about | favorites, thanks, saved places, dates, Valentine's | all |
| `with-icecream` | food | Лось облизывает рожок мороженого | Сладости, променад, жаркий день. | Licks a strawberry-vanilla ice cream cone. | happy | venue-listing, month-guide, route | sweets, promenade, kids, hot day | summer |
| `with-idea-bulb` | hint | Лось поднял руку, над ним лампочка-идея | Идея, совет, подсказка, «а вы знали». | Raises a hand with a glowing light bulb above. | inspired | longread, empty-state, modal | tips, ideas, did you know, hints | all |
| `with-key` | hint | Лось держит большой золотой ключ | Вход, доступ, открыть, квест, секреты. | Holds a big golden key. | pleased | auth, quest, modal | sign-in, access, unlock, secrets | all |
| `with-lantern-and-raincoat` | season | Лось в жёлтом дождевике с фонарём | Дождь, плохая погода, вечерние прогулки, маяки. | Yellow raincoat and hat, backpack, holds a lit lantern. | brave, cozy | month-guide, route, longread, modal | rain, bad weather, evening, night walks, lighthouses, forts underground | autumn, winter, spring |
| `with-lemonade` | food | Лось со стаканом лимонада | Жара, напитки, летние кафе. | Holds a glass of lemonade with a straw. | refreshed | venue-listing, month-guide, route | drinks, hot day, summer cafes | summer |
| `with-map` | travel | Лось с бумажной картой и сумкой | Планирование, маршруты, пустое состояние карты. | Reads a paper map, neckerchief and shoulder bag. | thoughtful | route, hub, map, empty-state | planning, routes, navigation, self-guided trips | all |
| `with-map-pin` | travel | Лось держит красную метку на карте | Локация, карта, «рядом с вами», адрес. | Holds a big red map pin. | helpful | map, place, venue | location, nearby, address, map | all |
| `with-megaphone` | offer | Лось кричит в рупор | Новости, анонсы, акции, важное объявление. | Shouts through a megaphone. | loud, excited | modal, home, event | announcements, news, offers, promo | all |
| `with-mushroom-basket` | nature | Лось в резиновых сапогах с корзиной грибов | Грибной сезон, лес, осенние прогулки. | Yellow rubber boots, basket full of mushrooms. | proud | month-guide, route, place | mushrooms, forest, autumn walks, nature | autumn |
| `with-organ` | place | Лось играет на органе, вокруг ноты | Органные концерты, Кафедральный собор, музыка. | Plays a wooden pipe organ, music notes around. | inspired | place, month-guide, longread | organ concerts, Cathedral, music, events | all |
| `with-pumpkin` | season | Лось держит тыкву | Осень, урожай, ярмарки, Хэллоуин. | Holds a big orange pumpkin. | cheerful | month-guide, hub, event | autumn, harvest, fairs, Halloween | autumn |
| `with-question-mark` | hint | Лось чешет голову, над ним вопросительный знак | Вопрос, FAQ, справка, непонятная ситуация. | Scratches his head, question mark above. | confused | about, empty-state, modal, search | FAQ, help, questions, unclear | all |
| `with-sandcastle` | coast | Лось строит замок из песка | Пляж с детьми, семейный отдых. | Kneels in sand with a red bucket next to a sandcastle. | playful | hub, month-guide, collection | beaches, kids, family | summer |
| `with-shopping-bag` | place | Лось держит пакет с покупками | Шопинг, магазины, рынки, сувениры. | Holds a yellow shopping bag. | happy | venue-listing, place, hub | shopping, markets, souvenirs, malls | all |
| `with-smartphone` | hint | Лось смотрит в смартфон | Приложение, онлайн, уведомления, Telegram-бот. | Taps on a smartphone. | engaged | modal, auth, about | app, online, notifications, contacts | all |
| `with-smoked-fish` | food | Лось с копчёной рыбой и кружкой | Коптильни, рыбные места, уличная еда, Куршская коса. | Holds a smoked fish and a mug, eyes closed with pleasure. | content | venue, venue-listing, place | fish, smokehouses, Curonian Spit, street food, fishing villages | all |
| `with-snowman` | season | Лось в вязаной шапке рядом со снеговиком | Зима, Новый год, праздники. | Red knitted hat, hugs a snowman in a matching hat and scarf. | cozy, festive | month-guide, hub, modal | winter, New Year, holidays, kids | winter |
| `with-soup` | food | Лось ест суп ложкой из миски | Местная кухня, горячая еда в холод. | Eats a hearty soup with a spoon. | satisfied | venue, venue-listing, month-guide | local cuisine, warm food, cold weather | autumn, winter |
| `with-star` | offer | Лось держит золотую звезду | Рейтинг, отзывы, лучшее, рекомендация. | Holds up a gold star. | proud | venue, collection, modal | ratings, reviews, top picks, recommendations | all |
| `with-sunglasses-and-sun` | season | Лось в тёмных очках держит солнце | Солнечная погода, лето, жаркий прогноз. | Sunglasses on, holds a little sun. | cool | month-guide, hub, modal | sunny weather, summer, heat, forecast | summer |
| `with-tickets` | offer | Лось держит два билета | Билеты, концерты, театр, бронирование. | Holds a ticket in each hand. | excited | event, venue, modal | tickets, concerts, theatre, booking | all |
| `with-tree` | nature | Лось обнимает дерево в лесу | Леса, парки, Танцующий лес, природа. | Hugs a big pine trunk among small firs. | peaceful | place, route, hub | forests, nature, Curonian Spit, dancing forest, parks, eco | all |
| `with-trophy` | celebration | Лось с кубком и медалью | Достижения, квест пройден, топы и награды. | Gold cup and medal around the neck. | triumphant | quest, modal, admin | achievements, quest finished, top lists, awards | all |
| `with-tulip-pot` | season | Лось держит горшок с тюльпанами | Весна, сады, ботанический сад, цветение. | Holds a clay pot with red tulips. | gentle | month-guide, place, hub | spring, gardens, botanical garden, flowers | spring |
| `with-watering-can` | nature | Лось с зелёной лейкой | Сады, огород, забота, «скоро вырастет» (в разработке). | Holds a green watering can. | caring | place, empty-state, month-guide | gardens, spring, coming soon, growing | spring, summer |
| `with-watermelon` | food | Лось держит ломтик арбуза | Лето, жара, пикник, фрукты. | Holds a big watermelon slice. | happy | month-guide, route, venue-listing | summer, picnic, hot day, fruit | summer |
