# ADR 0040: Editor token moderates guest rows

## Status

Accepted.

## Context

ADR 0036 lets a signed-in guest send a review, a tip, a photo, or a correction. Nothing is public while `pending`. `/admin/guests` accepts, rejects with a note for the author, or flags a dispute. A recognizable face is always a reject. The daily pass was described as the K39 Grok Bot working that queue.

The same record left "MCP submit or approve tools" out of scope, and it said the editor token does not accept guest rows. The bot then had no tool that shares the admin writer. Nick decided on 2026-10-16 that the editor bot moderates this queue daily through the K39 MCP.

## Decision

ADR 0036 is amended on this one point. Guests still cannot submit through the MCP. The draft token (`CONTENT_DRAFT_TOKEN`) cannot list, approve, reject, or flag a guest row. The editor token (`CONTENT_API_TOKEN`) can, and only that token.

Four tools, oldest pending row first on the list:

- `guests_pending_list`
- `guest_approve`
- `guest_reject`, with the reason stored for the author
- `guest_dispute_flag`

They call `moderateGuest`, the same function as `POST /api/admin/guests/:id`. There is no second writer. Approve of a photo whose caller sets `recognizableFace: true` is a reject through that function, with the face reason, and the file is deleted. A guest's statement that someone else agreed does not clear a face. A clear price report is still only a `guest_report` signal. The bot does not write `venue_prices`.

## Consequences

The daily pass uses the editor token. The draft token stays on editorial drafts. `/admin/guests` remains the owner's screen for disputes. A later change that lets a guest submit through MCP is a new record.
