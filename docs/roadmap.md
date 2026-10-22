# Roadmap

Updated 2026-10-22 from the [implementation inventory](product-state.md), baseline `2ab2794`. Two priorities: stabilize the existing product and make agent tasks easier and faster. Dispositions below are proposals; no feature is hidden by this plan itself.

## 1. Establish a truthful baseline

Deliver the capability inventory, known gaps, evidence limits and this work order. Correct unsupported claims in README and AGENTS. Treat accepted ADRs as decisions rather than delivery receipts. Preserve future offers design in ADR 0017.

Exit: a developer can identify a capability, its limits, the evidence and next task without reconstructing the chat. This first deliverable does not certify whole-product readiness.

## 2. Make agent development reproducible

Resolve the installation/toolchain issue described in the inventory within the active dependency policy. Do not disable checks or blindly regenerate the lockfile. Prepare local Postgres 18, migrations, fixtures and the guarded local editor session.

Measure fresh checkout-to-ready time, warm start, one representative quick check and the full gate. Use these timings to choose improvements:

- Separate portable project setup/diagnostics from host-specific Cursor/Linux adapters. A normal task should not need global tool rewrites.
- Shorten mandatory AGENTS context to invariants, commands and a task-routing map; preserve detail in linked, verified domain guides. Keep one source per rule and the shared skill directory.
- Review changed-package versus transitive-consumer checks. A faster loop must still catch a shared contract breaking its consumers.
- Separate explicit formatting from read-only verification if the current full check causes unrelated diffs.
- Make the affected page/API/admin/MCP/writer/test paths discoverable for each task, with a concrete completion contract.

Exit: clean setup on the supported toolchain, documented actionable diagnostics, measured loop timings, and passing repository validation, lint, typechecks, full tests and production build. Required checks remain required before opening a PR. Do not invent a speedup target before measuring the baseline.

## 3. Fix confirmed public inconsistencies

Keep changes separately reviewable:

1. Venue listing availability: failed request preserves results and offers retry; genuine zero results remain distinct. Cover network/HTTP failure, retry and toggling at 390px/1440px.
2. Map SEO/navigation: intended clean map URL in sitemap, ADR 0037 title and no duplicate navigation entry. Assert generated output and filtered-URL canonical/noindex rules.
3. Eat-now location: explain denial/timeout/unavailability and keep centre-based results usable. Check success as well as failure.
4. Documentation: correct operational timing/session claims and distinguish repository defaults from production configuration.

Exit: focused regressions, before/after evidence for public UI changes, required checks and post-merge deployment verification. No redesign bundled into a defect fix.

## 4. Accept the tourist core through real scenarios

Review desktop/mobile and no-JS, slow, error and unknown states where applicable:

1. Search or hub -> place -> access/hours/price/source -> directions.
2. Place -> route -> ordered stops -> map and external navigation.
3. Place/route -> nearby food -> venue -> current status/menu price/contact.
4. Map -> filters/search -> selected place/route -> useful destination, including missing tiles/WebGL and API failure.
5. Collection/month guide -> useful outing, including picker answers, reset and shared URLs.

Use real published content for read-only acceptance and isolated fixtures for writes. Keep content defects separate from code defects. Trace database-backed facts and freshness rules rather than proofreading prose alone.

Exit: each scenario has evidence; remaining defects have reproducible triggers and acceptance criteria; the owner can identify which capabilities are ready to promote.

## 5. Decide unfinished product scope

| Direction | Starting recommendation | Decision needed |
| --- | --- | --- |
| Quests | Rework or reduce promotion | Editorial walk or interactive challenge with saved completion? |
| Picker/personas | Pilot; defer expansion | Does remembered ordering improve a specific planning task? |
| Price comparisons and eat-now | Keep where data supports the promise | Which towns/items have sufficient verified coverage? |
| Tourist cabinet and guest materials | Pilot with an accountable moderator | What job justifies login, and who handles submissions/disputes? |
| Business claims/owner cabinet | Controlled owner pilot | Who operates claim review, delivery, revocation and fact conflicts? |
| Offers/redemptions/billing | Defer | Revisit after core acceptance and an explicit partner-pilot decision |

Hiding must cover navigation, direct URLs, crawl rules, search, writes and data retention together. Do not delete tables as a shortcut to reducing public scope. Preserve editorial/staff access where needed.

Exit: record accepted dispositions with visibility rules and acceptance criteria; implement each in a focused PR.

## 6. Verify the editorial and operational loop

Exercise draft -> review -> publish -> source change/expiry -> verification queue -> correction -> public output for places, routes, collections and venues. Include concurrent edits, owner conflicts, media persistence, notices, hours, ticket prices and events. Verify editor/draft-token boundaries on fixtures. Review deployment, migration, backup/restore and job freshness. Validate the usefulness and accuracy of analytics/scores.

When a workaround appears, record its trigger, original reason, current callers and replacement. Remove it in the relevant task with regression proof. Preserve necessary fallback, compatibility and database-safety behavior.

Exit: an editor can maintain the accepted scope and recovery is demonstrated rather than inferred from tables.

## 7. Reconcile docs per verified subsystem

Update the current guide and AGENTS entry, then annotate implementation status in relevant ADRs while preserving decision/supersession history. Separate implemented, deferred and retired behavior. Remove duplicated contradictory instructions after confirming their replacement. Keep this inventory and roadmap current after acceptance.

Exit: README describes the actual product, AGENTS supports efficient development, ADRs distinguish intent from implementation, and a new task starts from a clear tested state.

## Deferred business funnel

ADR 0016 defines scoring/passports; a score does not certify content truth or a finished user scenario. ADR 0017 retains the proposed manual offer pilot (claim/redeem a code without billing), then redemption accounting and a business offer cabinet. The existing venue-owner cabinet under ADR 0031 is a separate capability. Payment capture and auctions remain later work. Tables and presentation alone do not complete these phases.
