# Mascot stickers

The K39 moose is a cartoon mascot. 28 stickers live in `apps/web-app/public/stickers/`. The typed catalog is `apps/web-app/shared/stickers.ts`; the component is `<Sticker>`.

## Usage rules

- At most two stickers on one page. One is the norm. Zero is fine.
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
```

`<picture>` with AVIF and WebP sources at 128, 256 and 512 px (`sizes` equals the given width), PNG fallback at 256 px. Lazy loading by default; `priority` makes it eager.

## Files

- `{slug}-{128|256|512}.avif`, `{slug}-{128|256|512}.webp`, `{slug}-256.png`.
- Sources are Nick's originals (about 1000 to 1500 px, transparent). The alpha box is trimmed and a uniform 3% transparent padding is added, so all stickers sit the same way. Resized with Lanczos, no upscaling needed. AVIF quality 60, WebP quality 82.
- To add a sticker: process the same way, add an entry to `shared/stickers.ts`, and describe it here.

## Catalog

| Slug | What the moose does | Mood | Page types | Themes | Seasons |
| --- | --- | --- | --- | --- | --- |
| `amber` | Holds a big glowing raw amber nugget in both hands, proud smile. | proud | place, hub, collection, longread | amber, museums, souvenirs, Yantarny | all |
| `beach-1` | Tourist in sunglasses and a blue Hawaiian shirt, backpack on, shows a scallop shell. | cheerful | hub, month-guide, route, collection | beaches, resorts, seaside holiday, arrival | summer |
| `cook-with-pan` | Chef hat, holds a frying pan with sizzling vegetables. | busy, happy | venue, venue-listing, hub, longread | food, restaurants, recipes, local cuisine | all |
| `detective` | Flat cap and magnifying glass, inspects an ancient amphora. | curious | place, longread, quest, search | history, archaeology, museums, quests, mysteries, not found | all |
| `fish` | Holds a smoked fish and a mug, eyes closed with pleasure. | content | venue, venue-listing, place | fish, smokehouses, Curonian Spit, street food, fishing villages | all |
| `fishing` | Holds a fishing rod with a small fish on the line. | cheerful, patient | place, route, month-guide | fishing, lagoons, lakes, rivers, slow day | spring, summer, autumn |
| `hungry` | Napkin tucked in, fork and knife in hands, waiting for food. | hungry, eager | venue-listing, hub, route | where to eat, lunch stop, food | all |
| `knight` | Knight armor and visor, wooden sword, stands by a castle tower. | brave, playful | place, hub, collection, quest | castles, forts, Teutonic Order, kids, quests | all |
| `on-beach` | Lies on a striped towel under a beach umbrella, relaxed. | lazy, relaxed | hub, month-guide, collection | beaches, rest, resorts, weekend | summer |
| `photographer` | Flat cap, takes a photo with a big camera. | focused | place, route, collection, longread | viewpoints, photo spots, architecture, media upload | all |
| `postman` | Yellow scarf and blue mail bag, stands and smiles. | friendly, calm | about, modal, auth | mail, postcards, subscriptions, success messages | all |
| `postman-hi` | Yellow scarf and blue mail bag, waves hello. | friendly | home, about, auth, modal | greeting, sign-in, newsletter, contacts, welcome | all |
| `shocked` | Open-mouthed surprise with lightning bolts around. | shocked | error, modal, longread | errors, 404, surprising facts, warnings, storms | all |
| `swimming` | Swim goggles, floats in a pink rubber ring. | joyful | hub, month-guide, place | swimming, sea, lakes, water parks, kids | summer |
| `with-amber-chest` | Opens a wooden treasure chest full of glowing amber. | delighted | quest, collection, modal | treasure, rewards, quests, amber, hidden gems | all |
| `with-bag-and-stick` | Big hiking backpack and walking stick, ready to go. | adventurous | route, hub, month-guide | hiking, trails, nature, eco paths, national park | spring, summer, autumn |
| `with-bicycle` | Rides a blue bicycle with a wicker basket. | cheerful | route, place, month-guide | cycling, bike routes, promenades, coast | spring, summer, autumn |
| `with-coffee-and-croissant` | Cup of coffee and a croissant. | cozy | venue, venue-listing, route | coffee, breakfast, cafes, morning | all |
| `with-heart` | Hugs a big red heart. | warm | modal, auth, about | favorites, thanks, saved places, dates, Valentine's | all |
| `with-icecream` | Licks a strawberry-vanilla ice cream cone. | happy | venue-listing, month-guide, route | sweets, promenade, kids, hot day | summer |
| `with-lamp-and-raincoat` | Yellow raincoat and hat, backpack, holds a lit lantern. | brave, cozy | month-guide, route, longread, modal | rain, bad weather, evening, night walks, lighthouses, forts underground | autumn, winter, spring |
| `with-map` | Reads a paper map, neckerchief and shoulder bag. | thoughtful | route, hub, map, empty-state | planning, routes, navigation, self-guided trips | all |
| `with-organ` | Plays a wooden pipe organ, music notes around. | inspired | place, month-guide, longread | organ concerts, Cathedral, music, events | all |
| `with-sandcastle` | Kneels in sand with a red bucket next to a sandcastle. | playful | hub, month-guide, collection | beaches, kids, family | summer |
| `with-snowman` | Red knitted hat, hugs a snowman in a matching hat and scarf. | cozy, festive | month-guide, hub, modal | winter, New Year, holidays, kids | winter |
| `with-soup` | Eats a hearty soup with a spoon. | satisfied | venue, venue-listing, month-guide | local cuisine, warm food, cold weather | autumn, winter |
| `with-tree` | Hugs a big pine trunk among small firs. | peaceful | place, route, hub | forests, nature, Curonian Spit, dancing forest, parks, eco | all |
| `with-trophy` | Gold cup and medal around the neck. | triumphant | quest, modal, admin | achievements, quest finished, top lists, awards | all |
