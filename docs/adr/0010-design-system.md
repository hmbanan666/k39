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

## Consequences

A new control is a small Vue file plus tokens, not a utility-class recipe. Reka updates can change unstyled DOM, so dialogs, selects, and accordions need a visual check after an upgrade. The client bundle should shrink because Nuxt UI and Tailwind are gone.
