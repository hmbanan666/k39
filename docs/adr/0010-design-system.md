# ADR 0010: Reka UI and local CSS tokens

## Status

Accepted.

## Context

Public pages must stay server-rendered and readable. `@nuxt/ui` brought Tailwind, a large client bundle, and a generic component look that fights the postcard direction for K39.

## Decision

Behavior and accessibility come from [Reka UI](https://reka-ui.com) (`reka-ui`). It is headless: no theme and no utility classes. Visual design is our CSS.

- Tokens live as custom properties in `apps/web-app/app/assets/css/tokens.css`.
- Base rules and component classes live in `base.css`. Vue components add only scoped rules.
- Tailwind and `@nuxt/ui` are removed. There is no Tailwind config.
- Fonts are Alegreya (headings), Alegreya SC (stamps and labels) and Golos Text (body). `@nuxt/fonts` uses the Google provider only as a build-time source: it downloads Cyrillic and Latin subsets for the weights we list, writes them into the build, and the browser loads them from this origin. `font-display` is `swap`. Main weights are preloaded. Fontaine fallback metrics (size-adjust and related overrides) keep the fallback from shifting the page. There is no runtime request to fonts.googleapis.com. The image build needs network on the first fetch; Nuxt caches the files for later builds in the same environment.
- Light theme is the default. Dark tokens exist under `[data-theme="dark"]` and are not switched on.
- The component list, type scale, and the partner-offer label rule are in `docs/design-system.md`.
- Brand files in `apps/web-app/public/` have fixed roles. Tab icon: `favicon.ico` (PNG frames at 16, 32, and 48) plus `favicon-16.png` and `favicon-32.png`. Touch icon: `apple-touch-icon.png` (180, opaque, flattened on `#F5EEE1`). Install icons: `icon-192.png`, `icon-512.png`, and `icon-maskable-512.png` (the artwork sits in the square inscribed in the 80% safe circle, on `#F5EEE1`). Header moose, placed before the plain-text wordmark K39: `logo/moose-head` (png and webp, 1x and 2x). Organization logo: `logo/moose-head-512.webp`. Default social card: `og-default.png` and `og-default.jpg`. Install manifest: `site.webmanifest`. Browser `theme-color` is the brick token `#a3402a`, the same value as the manifest.
- The source master is kept outside the repo. The icon set above, not the header moose and not the social card, changes only through `node scripts/brand/render-icons.mjs <master>`. That script writes the icon files and sets `BRAND_ICON_VERSION` in `apps/web-app/shared/seo.ts`, then writes the same `?v=` onto each manifest icon. Favicon, touch icon, and manifest URLs use that query because the file names stay and the binaries cache for a week (the manifest caches for a day). Do not re-encode those binaries by hand. There is no SVG favicon.

## Consequences

A new control is a small Vue file plus tokens, not a utility-class recipe. Reka updates can change unstyled DOM, so dialogs, selects, and accordions need a visual check after an upgrade. The client bundle should shrink because Nuxt UI and Tailwind are gone.
