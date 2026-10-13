# Visual Refinement Preview

Captured from the local working-tree preview on 2026-10-13. These are rendered
screens, not design mockups. These captures document local visual verification,
not deployed-service acceptance. Earlier published-release screenshots remain
in the parent directory.

Landing captures precede the final copy refinement: the category label is now
"The hospital media library" and the hero begins "Find the right photo. Check
its usage rights." The final copy was separately checked on desktop and mobile.

| View | Desktop | Mobile |
| --- | --- | --- |
| Landing | [1440x900](landing.png) | [390x844](landing-mobile.png) |
| Staff access | [1440x900](staff-sign-in.png) | [390x844](staff-sign-in-mobile.png) |
| Library | [1440x900](library.png) | [390x844](library-mobile.png) |
| Review editor | [1440x900](review.png) | [390x844](review-mobile.png) |

Library and review captures use existing illustrative fixtures on an isolated
local origin, visibly labeled Sample data in the workspace. They contain no
private hospital media, real staff identity, or production credentials. Fixture
sessions were signed out after capture. Access and landing use the local preview
configured for the real services; production authentication is unchanged.

## Direction

Claude's initial consultation and Codex agreed on a restrained photographic
archive: a shared frame mark, editorial wordmark, consistent readable type,
quiet surfaces, and task-first staff controls. Codex retained the full-width
photographic hero rather than a text-first hero, used neutral white/gray instead
of a dominant paper-tan palette, and self-hosted licensed Source fonts for
cross-device consistency.

The changes include immediate mobile staff access, an uncluttered login,
underlined role-aware navigation, result-specific counts, clearer metadata,
review-first entry, consent and rights before descriptive fields, and a sticky
save area. Compliance referral preserves recorded consent and rights.

Claude reviewed the source again and flagged hints, weight mapping, old logo
selectors, repeated fallback text, sign-in announcements, tab-group semantics,
and the close target. Those findings were independently checked and addressed.
That follow-up could not open the temporary captures because its file access
was scoped to the repository; Codex inspected the rendered captures directly.

## Checks

- 29 frontend tests passed after the copy refinement; TypeScript and production build passed.
- Desktop 1440x900, mobile 390x844, and narrow 320px landing: no horizontal overflow.
- Grid/list switching, menu Escape/focus recovery, signed-out privacy, review
  entry, mobile role controls, and upload selection across navigation checked.
- Local fixture sessions removed through sign-out; no upload or invitation sent.
- Font assets are WOFF2 with included OFL licenses; no npm dependency added.
- Backend and infrastructure were not changed or re-deployed for this pass.

Intended staff visual acceptance and real-service release QA remain separate
from this local design preview.
