# Implementation inventory

Snapshot: 24 October 2026, [main at PR 315's merge](https://github.com/hmbanan666/k39/tree/4f505e503fb82c47fb1bcf993d5509033b4483c5). This inventory identifies code surfaces and contract tests. It is not a production-content audit, deployed-version check or whole-product acceptance. Current work belongs in [GitHub Issues](https://github.com/hmbanan666/k39/issues).

Paths beginning `app/`, `shared/` or `server/` are under `apps/web-app/`. Capability identifiers are retained for interpreting historical evidence; they are not task numbers or priorities.

## Implemented surfaces and boundaries

| Capability | Implementation at the snapshot |
| --- | --- |
| F01 · Place articles and category hubs | `server/utils/public-pages.ts`, `app/pages/[slug].vue` and hub pages render published articles, sources, typed sections and facts from Postgres. |
| F02 · Routes and directions | Ordered stops, optional stored geometry, embedded maps and external directions. |
| F03 · Visitor and embedded maps | `packages/map`, `server/utils/map` and `app/pages/map` share scene data and map behavior. |
| F04 · Collections and month guides | `app/pages/podborki` and `shared/page-modules.ts` support classic and module layouts. |
| F05 · Picker and remembered persona | `usePagePicker` and `useVisitorPersona` use URL answers and localStorage hints after hydration. |
| F06 · Quests | Editorial prose, route, map and stop cards; saved visit progress and quest completion controls are not implemented. |
| F07 · Venue catalog and pages | `server/utils/venues/public.ts`, `VenuePage` and venue listings read published listings and practical details. |
| F08 · Schedules and availability | `shared/schedule`, `server/utils/schedule.ts` and the availability API support rules, intervals, exceptions and unknown states. |
| F09 · Venue listing open-now filter | Failed requests preserve cards/map, announce failure and allow retry; [regression/browser evidence](reviews/2026-10-23-venue-availability/README.md). |
| F10 · Eat-now hub and proximity | `EatNowPage` and `loadEatNow` group statuses after hydration; location errors/retry preserve useful results; [isolated evidence](reviews/2026-10-23-eat-now-location/README.md). |
| F11 · Menu price anchors and bands | `comparable-prices.ts`, `menu-prices.ts` and `shared/price-compare.ts` separate the official comparison sample from owner prices. |
| F12 · Where-cheaper and item price pages | `server/utils/venues/price-page.ts` applies fresh-sample and crawl thresholds. |
| F13 · Ticket prices and dated events | `server/utils/practical`, `TicketsFact` and `UpcomingEvents` render source-backed rows with expiry. [ADR 0050](adr/0050-admission-extras.md) and [implementation evidence](reviews/2026-10-23-admission-extras-implementation/README.md) distinguish entry rows, extras and rollout boundaries. |
| F14 · Temporary closures and relocations | `server/utils/notices`, `TemporaryNotices` and `shared/notices.ts` affect availability without moving stored coordinates. |
| F15 · Site search | Postgres search, `/poisk` and reporting; failed/loading requests are distinct from completed zero-result searches; [evidence](reviews/2026-10-23-search-failure/README.md). |
| F16 · Admin editing and draft review | `server/utils/content/save.ts`, admin draft endpoints and `content_drafts` share save and staged-publication behavior. |
| F17 · Content MCP and token boundaries | Strict tool wrappers distinguish editor and draft capabilities. Collection staging validates effective inherited/sent source lists before storage; [PR 315](https://github.com/hmbanan666/k39/pull/315) and the [MCP reference](content-system.md#content-mcp) describe the contract. |
| F18 · Facts, verification queue and source watcher | `server/utils/facts`, source references, revisions and the verification queue support selected public fact projections. |
| F19 · Media processing and storage | Ingestion utilities, sharp image variants and attachment relations; see [storage](content-system.md#storage-and-bootstrap). |
| F20 · OAuth and personal cabinet | Shared auth session, profile, venue membership and guest-material workflows; see [authentication](content-system.md#authentication). |
| F21 · Venue claims and owner editing | Code/manual claims, membership and revisions; code delivery depends on configured transports. See [ownership](content-system.md#venue-ownership). |
| F22 · Guest reviews, tips, photos and corrections | Submission, moderation and cabinet workflows, separate from the removed legacy social product. See [guest submissions](content-system.md#guest-submissions). |
| F23 · Analytics, scores and editorial personas | Separate page/search collection paths, passports, jobs, persona coverage and reports. Scores describe editorial checks, not content truth; see [analytics](content-system.md#events-and-analytics). |
| F24 · Partner offer presentation | Offer/business/code tables and presentation exist; [ADR 0017](adr/0017-geo-offers.md) separates them from later transactional phases. |
| F25 · Redemption, bookings and billing | No completed public transaction flow is established by this inventory; schema columns do not establish delivery. |

## Contract entry points

A listed test establishes its own fixtures and contract, not complete scenario coverage or production readiness.

| Features | Existing contract / starting tests |
| --- | --- |
| F01–F02 · places and routes | [place rendering](../apps/web-app/test/place-page.test.ts), [route navigation](../apps/web-app/test/route-nav.test.ts), [ordered stops](../packages/database/src/repository/test/stops.test.ts) |
| F03 · map | [filter/query helpers](../apps/web-app/test/map.test.ts), [availability failures and races](../apps/web-app/test/map-availability.test.ts), [scene core](../packages/map/test/layers.test.ts), [discovery/SEO](../apps/web-app/test/map-discovery.test.ts) and [built-server output](../apps/web-app/scripts/check-map-discovery.mjs) |
| F04–F06 · guides, picker, quests | [modules](../apps/web-app/test/page-modules.test.ts), [month ordering](../apps/web-app/test/month-guide.test.ts), [persona values](../apps/web-app/test/visitor-persona.test.ts), [quest cards](../apps/web-app/test/quest-page.test.ts) |
| F07–F10 · venues and eat-now | [venue public helpers](../apps/web-app/test/venues.test.ts), [schedule cases](../apps/web-app/test/schedule.test.ts), [status consistency](../apps/web-app/test/status-consistency.test.ts), [eat-now grouping/distance](../apps/web-app/test/eat-now.test.ts), [location error/retry/races/SSR](../apps/web-app/test/eat-now-location.test.ts), [listing error/retry/races/SSR](../apps/web-app/test/venue-availability.test.ts) |
| F11–F12 · menu and comparison prices | [price comparison](../apps/web-app/test/price-compare.test.ts), [price repository](../packages/database/src/repository/test/prices.test.ts) |
| F13–F14 · tickets, events, notices | [practical rendering](../apps/web-app/test/practical.test.ts), [notice windows/rendering](../apps/web-app/test/notices.test.ts), [notice writers](../packages/database/src/repository/test/notices.writer.test.ts) |
| F15 · search | [page failure/retry/analytics/SSR](../apps/web-app/test/search-page.test.ts), [query helpers](../apps/web-app/test/search.test.ts), [repository matching/visibility](../packages/database/src/repository/test/search.test.ts) |
| F16–F18 · publishing, MCP, facts | [save entry](../apps/web-app/test/content-save.test.ts), [pending publish](../packages/database/src/repository/test/pending-publish.writer.test.ts), [MCP input registration](../apps/web-app/test/mcp-strict-input.test.ts), [facts](../apps/web-app/test/facts.test.ts) |
| F19 · media | [pipeline](../apps/web-app/test/media-pipeline.test.ts), [ingest writer](../packages/database/src/repository/test/media-ingest.writer.test.ts) |
| F20–F22 · accounts, claims, guest submissions | [guard](../apps/web-app/test/auth.test.ts), [cabinet helpers/rendering](../apps/web-app/test/cabinet.test.ts), [claim repository](../packages/database/src/repository/test/claims.test.ts), [guest lifecycle](../packages/database/src/repository/test/guests.test.ts), [moderation scopes](../apps/web-app/test/guest-mcp.test.ts) |
| F23 · measurement | [analytics](../apps/web-app/test/analytics.test.ts), [scoring](../apps/web-app/test/scoring.test.ts), [persona coverage](../apps/web-app/test/persona-coverage.test.ts) |
| F24–F25 · commercial funnel | [ADR 0017](adr/0017-geo-offers.md) explicitly separates presentation from future transaction phases |

Tests and isolated browser captures do not establish the deployed SHA, production flags, real-source accuracy, authenticated end-to-end acceptance or backup/restore durability. Historical observations keep their original date and environment limits.

## Evidence and maintained references

The [development guide](development.md), [application reference](content-system.md), [facts guide](facts.md), [venue guide](venue-modules.md) and [ADR index](adr/README.md) describe maintained contracts. The [agent-loop measurements](reviews/2026-10-23-agent-loop/README.md) and [verification-coverage proof](reviews/2026-10-23-verification-coverage/README.md) retain their raw evidence and reproduction tools; their host/workload limits apply.

The superseded [initial product audit](https://github.com/hmbanan666/k39/blob/4f505e503fb82c47fb1bcf993d5509033b4483c5/docs/reviews/2026-10-23-product-baseline/README.md) and [post-PR314 triage with its one-off probes](https://github.com/hmbanan666/k39/tree/4f505e503fb82c47fb1bcf993d5509033b4483c5/docs/reviews/2026-10-23-issue-triage) remain available at the reviewed merge commit. Their issue counts, proposed work order and reproduction results describe that dated snapshot, not current issue status.
