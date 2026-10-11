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

Motion is `--duration-fast` (120ms) and `--duration` (200ms). `prefers-reduced-motion: reduce` sets those to 0 and disables transitions.

Z-index: header 20, dropdown 30, dialog 40, consent 50, tooltip 60.

## Breakpoints

Layout shifts at 720px (two cards) and 900px (desktop nav, three nearby cards). Phone hub links scroll in one row. Screenshots are checked at 390px and 1440px.

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
| `SiteHeader` / `SiteFooter` | Logo mark, wordmark, hub pills. The header background is solid surface, sticky, with a bottom border. The active hub is highlighted. Админка is shown only to a logged-in admin. |
| `NearbyList` | Nearest places, name plus kilometres. |
| `RouteSteps` | Ordered stops. Each step is the place name. |
| `PartnerOffer` | Only for a real active offer. |
| `ConsentBanner` | Fixed toast at the bottom-left on desktop, a slim bar on a phone. It does not shift layout. |
| `UiAccordion` | Reka accordion. Default open when the copy must be read immediately. Content stays in the HTML. |
| `UiDialog` | Reka dialog. The public header uses a pill row instead of a menu button. |
| `UiTooltip` | Extra hint. The visible label still states the fact. |
| `UiField`, `UiInput`, `UiTextarea`, `UiSelect`, `UiSwitch` | Admin. Select and switch use Reka. Counters sit on the field. |

Do not add tabs for primary content. Closed panels must not be the only place a fact exists.

## Illustrations and stamps

Category art lives in `apps/web-app/public/illustrations/` and is the approved moodboard SVG, unchanged: `fort.svg` (default), `castle.svg`, `beach.svg`, `dunes.svg`, `museum.svg`, `cathedral.svg`, `food.svg`, `postmark.svg`. `illustrationFor()` maps a hub slug to a file. A place photo from `media` replaces that file. `kafedralnyi-sobor` uses `cathedral.svg` because the cathedral sits in the museum category.

`Stamp` is the perforated frame (radial-gradient mask). `Postcard` is the paper card. The place hero and the home collage tilt and carry a stamp with `postmark.svg` over that corner. Home hub tiles get a small numeral stamp. Nearby cards and hub lists do not, so a long list is not a sheet of stamps.

## Partner offers

The visible label is the words `партнёр K39`, not only a color. The title and terms are the offer itself. Do not call it free, official, or the best. If there is no active offer, render nothing.
