# K39 design system

Postcard Königsberg: paper, brick, Baltic grey-blue, amber, dune, pine. Confident and readable. Not a SaaS dashboard, not a souvenir shop.

## Tokens

Defined on `:root` in `apps/web-app/app/assets/css/tokens.css`.

| Token | Role |
| --- | --- |
| `--bg`, `--surface` | Page paper and card paper |
| `--text`, `--muted` | Body ink and secondary ink |
| `--accent`, `--color-brick` | Fort brick, primary buttons |
| `--color-line` | Card borders, `#e2d5bf` |
| `--color-brick`, `--color-brick-dark` | Buttons and brick accents, `#a3402a` / `#7a2e1f` |
| `--color-sea`, `--color-sea-light` | Links and the route band, `#355468` / `#dce5e8` |
| `--color-amber`, `--color-amber-soft`, `--color-partner` | Partner offer, `#d68a22` / `#f6e2be` / `#7a4c0b` |
| `--color-sand`, `--color-pine` | Dune and pine |
| `--color-success`, `--color-warn`, `--color-danger` | Status colors |
| `--focus` | Focus ring, `#1f6a8c` |

Paper is `#f5eee1`, surface `#fffbf3`, ink `#2b2420`, muted `#6a5d52`. The palette board checks these pairs at WCAG AA. Button text is surface on brick. Link text is sea on paper.

Dark values are prepared under `[data-theme="dark"]` and are not applied.

## Type

- Headings: Alegreya. Stamps and the partner label: Alegreya SC. Body: Golos Text.
- `@nuxt/fonts` downloads only Cyrillic and Latin, weights 400 and 700 (Alegreya also italic 400), at build time. Pages preload those faces. `font-display: swap`. Fallback metrics come from Fontaine.
- Scale uses `clamp`: `--step--1` through `--step-3`.

## Space, radius, shadow, motion

Spacing is `--space-1` (0.25rem) through `--space-8`. Radii are small (`3px`), medium (`8px`), and a slightly uneven card radius. Shadows are soft ink, not glass.

`--frame` (76rem) and `--frame-pad` (1rem) are the shared column. The `.frame` class, `.page`, and `.page-wide` all use that width and those side insets. The header and footer backgrounds stay full-bleed; their inner rows use `.frame`. `/map` keeps the map full-bleed.

Motion is `--duration-fast` (120ms) and `--duration` (200ms). `prefers-reduced-motion: reduce` sets those to 0 and disables transitions.

Z-index: header 20, dropdown 30, dialog 40, consent 50, tooltip 60.

## Breakpoints

Layout shifts at 720px (two cards), 900px (desktop nav, three nearby cards), 1000px (place hero and the short-page facts column), and 1100px (reader rail). Phone hub links scroll in one row. Screenshots are checked at 390px and 1440px.

## Components

| Component | Use |
| --- | --- |
| `UiButton` | Primary, quiet, or sea. An `href` renders a plain `<a>`. |
| `UiLink` | Text link, always an `<a href>`. |
| `UiBadge` | Hub or status chip. Pass `href` when it navigates. |
| `MediaImage` | `<picture>` for a processed place photo: AVIF and WebP srcset, LQIP background, focal point, credit line. SVG art stays when there is no cover. |
| `Stamp` | Perforated postage frame (CSS mask). Optional picture and a short label. |
| `Postcard` | Paper card: picture, caption strip, shadow. Tilt, corner stamp, and postmark only when those props are set. |
| `PlaceCard` | A postcard for a place. Real media wins; otherwise the category SVG. No tilt and no stamp, so long lists stay quiet. |
| `PostcardHero` | One `h1`, optional kicker and lede, breadcrumb nav. Text pages, not the place hero. |
| `UiBreadcrumbs` | Visible crumbs. The same list is the BreadcrumbList JSON-LD. |
| `SiteHeader` / `SiteFooter` | Moose head, then the plain-text wordmark K39, hub pills. The header background is solid surface, sticky, with a bottom border. Logo and section links sit on the left of `.frame`; «Войти» or «Админка» sits on the right. On a phone the same links stay one scrolling pill row, inset with the frame. The active hub is highlighted. Админка is shown only to a logged-in admin. The subtitle under K39 is the `tagline` prop, default «Калининградская область», and it hides below 900px. |
| `NearbyList` | Nearest places, name plus kilometres. |
| `RouteSteps` | Ordered stops on a place page. Each step is the place name. |
| `RouteGuide` | Route page: MapLibre map of numbered stops, deep links, stop cards with the note and the straight-line leg, and «Как добраться» on each stop. |
| `K39Map` | MapLibre frame: paper basemap, round pins, clusters, and a pin card. `/map` is the full page. |
| `MapEmbed` | Compact frame on a place, venue, route, hub, collection, or quest. Nearby points within 1.2 km, fullscreen, and «Открыть на карте». |
| `DirectionsLink` | «Как добраться». Opens Yandex Maps with the point as the destination. |
| `PartnerOffer` | Only for a real active offer. |
| `PageModuleList` | Module page (ADR 0023). `PageModulePicker` is a bordered strip with one row of chips per question and a status line with «Сбросить». Selected chips are brick. Fitting cards get a brick border and «Под ваш выбор»; nothing is hidden. `PageModuleMonthStats` shows tiles and a collapsed full table. `PageModuleMonths` is a chip row with the current month filled. |
| `ReaderLayout` | Place, route, and collection articles. Table of contents from body headings when there are at least three `h2`s. Desktop rail from 1100px, mobile «Содержание». |
| `ReaderPartnerSlot` | One partner offer in the reader rail, or after the first section on a narrow screen. Renders nothing when no partner is passed. |
| `CookieNotice` | Compact postcard fixed to the bottom: surface, line, radius, pop shadow. One row when the copy and the brick button fit, otherwise the button wraps under the text. Client-only, so it does not shift ordinary pages. On `/map` the panel lifts by the card height so the card does not cover the panel or the map controls. Dismiss is a localStorage flag. |
| `UiToast` | Short status line, solid paper, brick edge. Auto-hides after 2.5 seconds. Sits clear of the search field. |
| `UiAccordion` | Reka accordion. Default open when the copy must be read immediately. Content stays in the HTML. |
| `UiDialog` | Reka dialog. The public header uses a pill row instead of a menu button. |
| `UiTooltip` | Extra hint. The visible label still states the fact. |
| `UiField`, `UiInput`, `UiTextarea`, `UiSelect`, `UiSwitch` | Admin. Select and switch use Reka. Counters sit on the field. |

Do not add tabs for primary content. Closed panels must not be the only place a fact exists.

## Illustrations and stamps

Category art lives in `apps/web-app/public/illustrations/` and is the approved moodboard SVG, unchanged: `fort.svg` (default), `castle.svg`, `beach.svg`, `dunes.svg`, `museum.svg`, `cathedral.svg`, `food.svg`, `postmark.svg`. `illustrationFor()` maps a hub slug to a file. A place photo from `media` replaces that file. `kafedralnyi-sobor` uses `cathedral.svg` because the cathedral sits in the museum category.

`Stamp` is the perforated frame (radial-gradient mask). `Postcard` is the paper card. The place hero and the home collage tilt and carry a stamp with `postmark.svg` over that corner. Home hub tiles get a small numeral stamp. Nearby cards and hub lists do not, so a long list is not a sheet of stamps.

## Partner offers

The visible label is the words `партнёр K39`, not only a color. The title and terms are the offer itself. Do not call it free, official, or the best. If there is no active offer, render nothing. The reader slot uses the same component and stays empty while `FEATURE_SPONSORED_VENUES` is off (ADR 0022).
