# Staff Workflow Verification

Verified on 2026-10-13 using the deployed AWS backend, real Cognito sessions,
four disposable staff accounts, and a licensed public campus photograph from
the bundled illustrative media. No patient media or real staff identity was
used as test input. This is functional managed-pilot evidence, not customer
acceptance or a regulatory/security certification.

## Automated Checks

| Check | Result |
| --- | --- |
| Clean frontend lockfile install | Passed |
| Full dependency audit | 0 reported vulnerabilities |
| Frontend tests | 23 passed |
| TypeScript and production build | Passed |
| Backend tests | 40 passed, 92.65% reported aggregate coverage |
| Backend production handlers | Ingest 85%, search 87% line coverage |
| Terraform regression tests | 3 passed using mocked providers |
| Terraform formatting and validation | Passed; existing deprecation warnings remain |
| Saved-plan reconciliation after applies | No changes required |

Local backend tests used Python 3.14.6; actual Lambda workflows exercised Python
3.12. GitHub CI passed all 40 backend tests on Python 3.12 with 92.65% aggregate
coverage. No separate lint script is configured;
the production build performs TypeScript checking.

## Live Staff Tasks

| Task | Observed result |
| --- | --- |
| Signed-out workspace | Search, filters, media cards, uploads, and privileged tools absent |
| Staff sign-in / sign-out | Real Cognito SRP sign-in and cleared private state on sign-out |
| First sign-in | Temporary-password challenge completed with a new permanent password |
| Session renewal | Expired QA cached tokens renewed through Cognito; resulting token accepted by live API |
| Rejected renewal | Revoked QA refresh session returned to sign-in and cleared private controls/token |
| Staff search | Live API results and signed image previews rendered |
| Upload | Public test image uploaded through the private S3 presigned PUT path |
| Ingest | Enabled worker indexed the image and created a pending review record automatically |
| Duplicates | Live UI reported an exact duplicate without another upload/ingest |
| Task navigation | Selected upload survived Library / Upload navigation |
| Review | Missing consent/rights blocked approval; completed policy saved successfully |
| Queue refresh | Approved QA photo left the pending queue |
| Role preservation | Restricted role list loaded in the editor and survived metadata saves |
| Approval API | Missing/unknown/blank rights and unnamed campaign-limited approval rejected |
| Exact tags | QA tag found with `top_k=1` after pagination repair |
| Filters | Portrait filter excluded the architectural QA image, including curated matches |
| Admin invitations | Existing disposable account received reviewer role through the actual UI/API |
| Assigned roles | Invited reviewer signed in with Library / Upload / Review, without Access |
| Marketing permissions | Review and admin endpoints returned 403; privileged views absent |
| Restricted media | QA image excluded from marketing search results |
| Anonymous search | API returned 401 |
| Detail interaction | Named dialog, initial focus, focus containment, Escape and focus return checked |
| Responsive workflow | Mobile 390x844 and desktop 1440x900; no horizontal overflow or broken image loads observed |
| Review form reachability | Mobile and desktop saves completed through scrollable detail panes |
| Public menu/request | Mobile Escape recovery, required fields, prepared-summary fallback, configured contact link |

The invitation check reused a pre-created QA account; no invitation email was
sent. A separate email-suppressed account exercised the real first-password
challenge. These checks do **not** establish email delivery to an intended staff
member or completion of a buyer's real onboarding session.

## Published Release

The [published site](https://photoscribe-ai.pages.dev/) was checked after the
release deployment completed. Signed-out private controls were absent. A real
QA Cognito account signed in, searched for the QA tag, opened a named photo
dialog with a loaded signed image, and signed out with private controls cleared.
The public CareFrame heading and configured pilot contact link were also checked.

- [Frontend tests, build, and deployment](https://github.com/manynames3/photoscribe-ai/actions/runs/38363662437): passed.
- [Backend tests and coverage](https://github.com/manynames3/photoscribe-ai/actions/runs/38363662572): passed.
- The earlier `c04c5a7` deployment failure was a test-fixture environment leak.
  API tests now explicitly isolate mock sessions from deployment Cognito settings;
  production authentication is unchanged. Subsequent deployments passed.

## Operational State

- Ingest worker enabled with existing concurrency limits.
- Source queue and dead-letter queue: zero visible or in-flight messages at check.
- All six deployed CloudWatch alarms were OK, including oldest-message age.
- Operational/billing SNS email subscription confirmed.
- Reviewed Terraform applies updated existing services; no AWS resources were
  created or deleted. Local packaging records were rebuilt for Lambda updates.
- Public pilot contact configured through a GitHub variable, not a committed
  private environment file. The form prepares an email; it does not claim it sent one.

## QA Cleanup

After published-site verification, ownership-guarded cleanup removed the four
disposable accounts, two S3 object versions (original and thumbnail), and the QA
vector and policy record. Their absence was verified before the private QA
credential file was removed. Only those accounts' browser credential keys were
cleared from the public and two local preview origins. Existing users, assets,
audit events, and unrelated browser state were preserved.

## Verification Limits

- The browser's screenshot capture timed out. No mock screenshots or private
  library images are published as evidence; interaction/DOM checks remain recorded
  above. A visual acceptance pass by intended staff is still valuable.
- Actual invitation delivery, MFA/SSO policy, account revocation procedures, and
  buyer security/legal/retention decisions require customer-side acceptance.
- Audit events use the configured TTL. They are not a customer-approved hospital
  retention or legal-hold policy.

See [end-user readiness](end-user-readiness.md) for the remaining buyer gates.
