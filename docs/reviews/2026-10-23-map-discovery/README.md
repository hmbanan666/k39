# Map discovery and SEO

Task: S02 / F03. Base: `5cd763c0337b7def9374e8305a615e373f72230e` (PR 287 merged).

## Changes and reason

- Register `/map` in the dynamic sitemap source. The existing `/map/**` exclusion also matched the clean `/map` URL in the installed sitemap module, so adding a source entry alone would not work. `/map/*/**` excludes child paths while allowing the clean URL. No synthetic lastmod date is added.
- Set the map's SEO override to produce `Карта Калининградской области | K39`. The shared collection title helper and other pages are unchanged.
- Remove the second `/map` entry from `SECTION_LINKS`. The actual footer now renders one map link.
- Keep the clean canonical and filtered-query `noindex` behavior, including `c`, `s`, `f`, `r`, `q` and `focus`; tracking-only links stay indexable. Invalid map child paths still return 404.

## Regression evidence

[Map-discovery tests](../../../apps/web-app/test/map-discovery.test.ts) call the actual map loader and sitemap handler with isolated database readers and render the real footer. Ten cases assert source registration, one footer link, title/OG title, canonical, six filter keys and tracking-only behavior. These do not substitute for the final sitemap module output.

The standalone SSR smoke now calls [check-map-discovery.mjs](../../../apps/web-app/scripts/check-map-discovery.mjs). Against the real built Nitro server it checks title/canonical/robots on clean, filtered and tracking-only map URLs, the homepage footer and the final `/sitemap.xml`: exactly one clean map URL, no query or child map URLs. Existing smoke checks retain 404s for `/map/forty` and `/karta`.

## Footer screenshots

The real footer component and baseline links are rendered with production CSS and built fonts. This is a component-level local browser check, not a production deployment or map interaction test. No API fixtures or altered footer markup are used. Browser assertions confirm two map links before, one after, a `/map` target, no page errors and no horizontal overflow. Brand tokens and type are unchanged.

| Width | Before | After |
| --- | --- | --- |
| 390px | [Screenshot](before-390.png) | [Screenshot](after-390.png) |
| 1440px | [Screenshot](before-1440.png) | [Screenshot](after-1440.png) |

Reproduce after a web build from the repository root:

```bash
pnpm exec playwright install chromium
node docs/reviews/2026-10-23-map-discovery/capture.mjs
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing browser. This host used the same isolated Chromium 153 as S01, with no new project dependency. The [capture script](capture.mjs) reads the before component and links from the exact base commit above.

## Validation and rollout

Local targeted tests (10 cases), browser capture, repository validation, lint, web-app/writer typechecks, documentation-link and diff checks passed. The wider local `check:quick` did not pass: two related DB suites require unavailable Postgres/Docker, and MCP registration exceeded its 5-second limit. An isolated diagnostic MCP run passed both tests with a command-line 30-second allowance (7.87 seconds of tests); the repository timeout is unchanged. The same test passed under the normal CI settings.

[Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/39941253578) passed on `d90cfa59ebc2eee4c455d1e8f2a1374d81f4283b`: frozen install, repository validation, ESLint, all typechecks, 794 tests across 117 files, production build, standalone SSR including the new final-XML/head/footer checks, and Docker image build. The final follow-up records this evidence, removes the temporary branch push trigger and preserves the existing executable mode on the smoke script; its tested contents are unchanged. Final CI policy is unchanged, and normal PR CI verifies the final head again. Local tooling is Node 24.19.0 / pinned pnpm 12.15.0; full CI uses the project Node pin and Postgres 18.

After merge, verify the deployed SHA, `/map` metadata, a filtered map URL, footer navigation and the live sitemap. This change does not claim search-engine recrawling or a verified production deployment.
