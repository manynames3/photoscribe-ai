# CareFrame Product Experience Review

Reviewed with local subscription-authenticated Claude Code and independently checked by Codex on 2026-10-13. Claude's initial assessment was source-only; Codex owns integration, tests, and rendered verification. This is a product review, not a readiness certification.

## Agreed Priorities

The previous interface had a workable staff shell but was held back by repeated technical marketing copy, a missing mobile landing menu, placeholder thumbnails, fragile task state, and inaccurate clearance guidance.

1. A media library must accurately distinguish approval, consent, rights, expiry, and restricted access. Approval shortcuts must never fabricate consent or rights.
2. Uploads and searches must survive ordinary staff navigation. Late responses must not overwrite current results or repopulate a signed-out session.
3. Photo details must work with keyboard focus, Escape, and screen readers. Saving must retain confirmation and refresh the queue.
4. Sessions need Cognito refresh and an explicit return to sign-in after expiry.
5. The public page should explain the hospital workflow in five sections, with a clear CareFrame identity and accessible navigation.
6. The pilot form must show an honest, useful outcome even when no contact destination is configured.

## Implemented Direction

- Photo-led public landing page with five sections, a mobile menu, the established CF mark, and a working request-summary/email flow.
- Public illustrative photographs stored locally with credits; private assets remain behind staff sign-in. Sample policy records are explicitly fictional.
- Shared clearance rules used on cards and photo details. Unknown consent or rights cannot be promoted by the approval shortcut or save action.
- Workspace views reflected in URL hashes and browser history, with role guards. Uploads stay mounted while navigating, and active uploads warn on page unload.
- Search responses are sequenced; filter changes use the submitted phrase. Sign-out closes photo details and invalidates outstanding search responses.
- Cognito session refresh before authenticated API requests; rejected sessions return to sign-in.
- Named modal, initial focus, focus containment, Escape handling and focus return. Save confirmation persists and review queues refresh.
- Readable policy labels, larger controls, live status messages, and reduced-motion handling.
- Preserved saved-role metadata throughout API results and edits; server approval guards include blank rights and campaign-only context.
- Scrollable photo editor on desktop and mobile; delayed saves cannot reopen closed or signed-out photo details.
- Session refresh isolation across sign-out, exact-tag pagination, and metadata filters applied to curated matches.
- Lockfile remediation with no new application dependency; clean install/audit and a CI audit gate.

## Verification

The [staff verification record](staff-workflow-verification.md) covers real
Cognito sign-in, first-password setup, refresh/rejection recovery, private
upload, automatic ingest, duplicate feedback, approval, invitations, saved
roles, restricted access, and desktop/mobile interaction. Automated checks now
include 23 frontend and 40 backend tests. Screenshot capture initially timed out
but succeeded on retry; inspected public desktop/mobile and signed-out staff
captures are linked in the verification record. Private library media is not
published.

## Judgment Calls

Claude proposed SVG sample scenes and a simulated library panel for the landing hero. Codex chose licensed illustrative photographs and a full-width photo hero instead: the product is about photography, and private library contents should not be represented as publicly accessible.

Claude Motion was considered. The agreed motion scope is interaction feedback, loading and upload progress, with reduced motion supported. A separate animation dependency or specialist worktree would add complexity without fixing the identified user problems. Claude Code implemented the landing page in a disposable copy; Codex integrated it after source review.

## What A Top-Tier Release Still Requires

- Intended staff acceptance and real invitation email delivery. Functional QA used isolated accounts, not hospital employees.
- The public contact destination is configured. The current form prepares email in the visitor's mail app; server-side lead intake is not implemented.
- Account listing, role editing and revocation if the administration screen is expected to provide complete account management. The existing API currently supports invitations.
- Customer-specific SSO/MFA, security/legal acceptance, retention, and regulated-media procedures.

A literal 10/10 is not established by a reviewer rating. The release standard is trustworthy policy guidance, preserved work, accessible interaction, clear first use, and successful task completion by intended staff.
