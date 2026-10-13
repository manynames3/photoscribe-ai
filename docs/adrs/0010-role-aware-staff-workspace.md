# ADR 0010: Preserve Staff Task State And Asset Permissions

## Status

Accepted, 2026-10-13.

## Context

The public product overview and private library serve different audiences.
Stacking search, uploads, review, and invitations in one screen made tasks hard
to scan. Navigation could discard selected uploads, and policy edits did not
receive the saved allowed-role list from the API.

## Decision

Keep React, TypeScript, Vite, plain CSS, and the existing manual routing. Maintain
separate `/` and `/app` surfaces. Gate all private controls behind staff sign-in;
expose Library, Upload, Review, and Access according to staff roles. Preserve
view/query state in the URL and keep the upload panel mounted during ordinary
in-app navigation. Sequence searches and invalidate them at sign-out.

Use the existing Cognito SDK to refresh sessions before private requests and
return to sign-in after session rejection. Keep policy enforcement on the server.
Return `allowed_groups` with asset results, initialize the editor from those
roles, and preserve them on updates. Both client guidance and the API reject
approval without confirmed consent and rights. Campaign-limited rights require
a named campaign; they do not mean unrestricted public release.

Keep the photo dialog keyboard-accessible and constrain its scrollable detail
pane so all review fields and the save control remain reachable. Public imagery
is illustrative and credited; screenshots must not disclose private staff assets.

## Consequences

Staff get focused tasks without a framework migration or new production
dependency. The API contract gains a role-list field, so frontend and backend
must be released together. Tests cover permission initialization, approval
guards, stale searches, signed-out gating, and save confirmation. Navigation
preserves selections, but a full browser reload still needs an active-upload
warning rather than a false promise of persistent upload recovery.
