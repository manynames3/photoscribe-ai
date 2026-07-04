# End-User Readiness

CareFrame is intended to be usable by invited staff in a controlled managed pilot after the checks below pass against a deployed backend. It is not a claim of production hospital compliance, HIPAA compliance, or BAA readiness.

## Ready For A Managed Pilot When

- `/app` shows no search field, filters, result cards, signed image links, upload controls, review queue, or admin actions while signed out.
- An invited Cognito staff user can sign in and sign out successfully.
- A signed-in user can search a known approved asset and open its detail modal.
- Result details show owner department, review status, consent status, usage rights, visibility, campaign, location, and staff context.
- A signed-in user can upload a JPEG, PNG, or WebP file and see duplicate handling feedback.
- A reviewer or admin can load the review queue after ingest completes.
- A reviewer or admin can update asset policy fields and see those changes reflected in search results.
- An admin can invite a staff user and assign role groups.
- The smoke test passes for search, optional upload, optional policy update, and optional user invite.
- CloudWatch alarms, DLQ depth, and billing alerts are checked after deployment.

## Not Production-Ready Until

- Buyer security and legal review is complete.
- A BAA and HIPAA compliance path are in place if regulated patient-identifying media will be stored or processed.
- Enterprise SSO, MFA policy, user lifecycle, and access-review procedures are confirmed.
- Data retention, deletion, export, legal hold, incident response, and audit retention are approved by the buyer.
- Sensitive-content moderation and human review procedures are defined for any patient-identifying imagery.
- A penetration test or equivalent security review has been completed for the deployed environment.

## Smoke Test

Minimum backend smoke:

```bash
PHOTOSCRIBE_API_URL="$(terraform -chdir=terraform output -raw search_api_url)" \
PHOTOSCRIBE_AUTH_TOKEN="<cognito-id-token>" \
./scripts/smoke-test.sh
```

Full pilot-path smoke:

```bash
PHOTOSCRIBE_API_URL="$(terraform -chdir=terraform output -raw search_api_url)" \
PHOTOSCRIBE_AUTH_TOKEN="<admin-or-reviewer-cognito-id-token>" \
PHOTOSCRIBE_PHOTO_PATH="./sample.jpg" \
PHOTOSCRIBE_SMOKE_QUERY="hospital executive headshot" \
PHOTOSCRIBE_POLICY_ASSET_KEY="uploads/example.jpg" \
PHOTOSCRIBE_SMOKE_INVITE_EMAIL="reviewer@example.org" \
./scripts/smoke-test.sh
```

Use a dedicated test asset and test invite address for the full smoke path. The policy update and invite checks intentionally mutate the deployed environment.
