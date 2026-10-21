# ADR 0045: Goal grace and the status check

## Status

Accepted.

## Context

ADR 0016 scores organic goals inside the results block. A missing goal scored the full 35 and 25 points, and a goal the page had not reached scored only the proportion. Filling the passport, which quality rewards, therefore cut the results block on every page without traffic. On a site younger than the goal window, that is every page.

The same score flags a place whose text says it is closed while the schedule is not. The check ran on the joined page text. A closure whose subject is a tenant still matched, and FAQ entries reached the check as JSON, so a sentence boundary inside an answer was unreliable. A gate that is open all day lost 15 points because the restaurant inside is temporarily closed.

No column records the first publication. `mcp_audits` stores a tool name and a time, not the row that became public. A revision snapshot is the row before the write, so the publish instant is not a field on that snapshot. The publish path is the place that knows the instant, and it can keep it.

## Decision

### Status check

The check reads the article, the hours line, the directions line, and each FAQ answer as its own plain sentence. Callers pass the FAQ array. They do not pass `JSON.stringify` of it.

A closure phrase counts when it is about the place. The check receives the page title. In the clause that contains the phrase, the phrase is ignored when the text before it names another subject. Another subject is a tenant word (ресторан, кафе, бар, магазин, выставка, экспозиция, or `музей внутри`). A «quoted name» is another subject only when it sits directly after one of those words. «Ресторан «Розенгартен»» is not this page. A quoted name that is the title is the place, as in «Музей «Фридландские ворота»». A quoted name that is neither the title nor after a tenant word does not hide the closure: the score records `status warning: closure may refer to another subject` and does not subtract 15. When the words before that quote are already this page's title, the quote is the historic name inside that subject, and the closure costs 15. «Форт №5 «Король Фридрих Вильгельм III» сейчас закрыт для посещения» costs 15 when the title is «Форт №5».

A clause break resets the subject: `, а`, `, но`, and сам/сама/само. Words before that break do not belong to the closure. A closure about the place wins over a tenant clause in the same sentence, including when the tenant is named after a comma ("кафе на первом этаже", "кафе «Башня» тоже не работает"). A tenant word only in the words immediately after the phrase, before the next comma, is ambiguous. The score records `status warning: closure may refer to another subject` and does not subtract 15. A sentence that is clearly about the place, such as "Ворота временно закрыты на реставрацию", still contradicts an open schedule and still costs 15.

A sentence that links to another page (`](/`) stays ignored. Appointment wording is unchanged.

Two sentences keep a closure in the second one. A quoted name earlier in the same sentence does not hide a later closure once a clause break has reset the subject.

### Results

A missing goal scores no more than a set goal the traffic has not met. Once the window has elapsed, a missing 30-day goal scores 0 and the check is `no 30-day goal`. The 90-day goal uses `no 90-day goal`. A set goal that is missed stays proportional: `round(weight * actual / goal)`, with weights 35 and 25. A met goal still scores the full weight.

Goals are judged only after the page has been published and is indexable for that long, measured from `first_published_at`:

- the 30-day goal after 30 days
- the 90-day goal after 90 days

Until then a missing or unmet goal is neutral: half the weight, rounded with `Math.round(weight / 2)`, so 18 and 13. The check is `goal pending (N days)`, where N is the days left in that window. A page that is not published uses `goal pending (unpublished)`. A `noindex` page uses `goal pending (not indexable)`. A goal the traffic has already met (`actual >= goal`) scores its full weight during that hold and is not pending. Half weight stays the neutral point for a goal that is still open, so an empty passport does not outscore a passport whose goals are met, and it does not outscore one whose goals are still unmet. Quality points for filling the passport stay as they are.

`first_published_at` is set by the publish path the first time the row becomes `published`. Later saves keep it. Drafts stay null. A null value on a published indexable page is judged immediately, so a missing date is not an open-ended grace.

The migration sets the column for rows that are already published. A revision stores the row from before the write, so the earliest revision whose snapshot says published is the first edit after publish. Call that time t1. The stamp is the `created_at` of the latest revision whose snapshot is not published and whose `created_at` is less than or equal to t1. When t1 is missing, that bound is open. When no such revision exists, the page was created already published and the stamp is the row's `created_at`. Hubs use `categories.created_at`, because a hub has no separate publish step. That UPDATE is schema backfill. This change does not write live articles.

The weekly report's under-a-goal list skips a goal whose signal `goal30Pending` or `goal90Pending` is true. Admin and MCP otherwise keep the same score shape.

Half weight during the window is the neutral point for a goal that is still open. Paying that same half weight for a goal the page has already met would hide a page that reached its goal. At the same age and the same traffic, an empty passport does not outscore a passport that has goals.

## Consequences

Scores recompute on the next run, as today. A page at day 5 keeps an unmet goal pending. A goal it has already met scores full weight. At day 40 the 30-day goal is judged and the 90-day goal is still pending unless it is already met. At day 100 both are judged.

A closure about a named tenant does not cost 15. An unclear subject is a warning an editor can see. A real closure of the place still costs 15.

The clock does not subtract days the page spent as `noindex`. The score asks whether the page is indexable now and how old the first publication is. Time spent noindex is not stored.
