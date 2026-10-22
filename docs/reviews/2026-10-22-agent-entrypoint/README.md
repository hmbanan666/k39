# Agent entry point review

Base: `994e9258f91b83dff064c6e87ddf1e3e02e89edc` (merged PR 284).

## Result

The mandatory AGENTS entry point is reduced from 5,161 to 1,036 whitespace-separated words (36,975 to 8,987 characters). It contains the task-start workflow, invariants, a nine-row implementation/check map, skill selection and the final verification gate. Detailed material is loaded by task through anchored references.

This measures the size of the entry point, not a benchmark of agent latency, token billing or task completion speed. Runtime, scripts, dependency versions, CI policy and the seven skills are unchanged in the final diff.

## Where the original instructions went

| Original section | Destination |
| --- | --- |
| Product | AGENTS introduction/invariants and application-reference scope; unsupported progress promise removed |
| Architecture | [Application architecture](../../content-system.md#architecture); fixture catalog moved to development |
| Content MCP | [MCP](../../content-system.md#content-mcp), split into tool, fact, notice, map, auth, ownership, guest, analytics and search subsections |
| Conventions | AGENTS invariants, [commit hooks](../../development.md#commit-hooks) and [editing conventions](../../content-system.md#editing-conventions) |
| UI | AGENTS skill routing and [UI provenance](../../content-system.md#ui-and-assets); screenshot rules stay in the unchanged skill |
| Skills | AGENTS skill table; same seven files and precedence |
| Cloud agents / Run | [Setup](../../development.md#toolchain-and-local-setup), [environments](../../development.md#environments), [branch synchronization](../../development.md#branch-synchronization) |
| Test and build | [Checks](../../development.md#checks); quick iteration, then the full gate once, rather than an overlapping sequence of standalone checks |
| Deploy | [Deployment](../../development.md#deploy), preserving volumes, environment, migration and no-extra-deploy-workflow rules |
| Pages | [Page reference](../../content-system.md#pages) |

## Accuracy corrections

- Quest pages have editorial stops, not saved visit progress. README no longer promises that missing functionality or says all reviews were removed; moderated guest submissions exist.
- Notice expiry flag runs hourly, not nightly (`server/plugins/notice-expire.ts`).
- Map sitemap inclusion is an open implementation gap rather than a delivered claim (`server/routes/sitemap-urls.get.ts`).
- Consent-flag defaults and the shared user/editor/admin session are distinguished from unseen production settings; the cabinet already exists.
- Cursor/Linux boot scripts are an environment adapter, not a generic macOS/Work prerequisite. Setup examples preserve an existing .env.

These corrections do not implement the missing features or change production behavior. The rest of the detailed reference was relocated; this change does not certify every historical implementation claim.

## Verification

- `check:quick`: repository validation and Markdown ESLint passed; its planner selected no typechecks or Vitest for these documentation paths.
- Local Markdown links, anchors and code-map paths were checked for existence.
- The baseline [main CI](https://github.com/hmbanan666/k39/actions/runs/39843813603) is green for the unchanged runtime: 772 tests, build, SSR smoke and Docker checks.
- Fresh pre-PR CI evidence will be recorded after the branch checks finish. No new implementation-mirroring tests are added for a documentation reorganization.
