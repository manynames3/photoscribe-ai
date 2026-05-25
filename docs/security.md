# Security Model

PhotoScribe AI / CareFrame is designed as a private media-library pilot, not a public image-sharing app. This document summarizes the implemented controls, assumptions, and remaining production gaps.

## Implemented Controls

- **Private storage:** the photo bucket blocks public access and serves images through short-lived pre-signed S3 URLs.
- **Authenticated API:** Terraform enables Cognito JWT authorization for search, upload, review, admin, and asset policy routes by default.
- **Role groups:** Cognito groups map to library roles such as `admin`, `reviewer`, `marketing`, `hr`, `compliance`, and `facilities`.
- **Object-level policy:** the search Lambda checks DynamoDB asset policy rows before returning signed URLs.
- **Review default:** newly ingested assets default to `pending_review` so they can be approved, restricted, or rejected before broad use.
- **Missing-policy default:** Terraform defaults `missing_asset_policy_default` to `deny`, preventing legacy unmanaged assets from appearing accidentally.
- **Direct browser uploads:** the browser requests a pre-signed S3 PUT URL and never receives AWS credentials.
- **Duplicate control:** uploads use a SHA-256 content hash to skip exact duplicates before S3 PUT and Bedrock ingest.
- **Audit logging:** search and curation events are written to DynamoDB with TTL-based retention.
- **Least-privilege IAM:** ingest and search Lambdas use separate roles scoped to the required Bedrock, S3, S3 Vectors, DynamoDB, SQS, and Cognito actions.
- **Operational alerts:** Terraform provisions billing and failure alarms for cost spikes, Lambda errors, API 5xx responses, queue age, and DLQ messages.

## Data Handling Assumptions

- The managed pilot should use approved marketing, HR, communications, facilities, and event imagery.
- Do not upload patient-identifying or regulated clinical media unless a production compliance review and BAA are in place.
- The project does not claim HIPAA compliance.
- Staff names, consent, usage rights, campaign, location, and expiration fields are human-curated because the AI model should not infer legal approval.

## Secrets And Configuration

- Cloudflare deploy credentials belong in GitHub Actions secrets.
- Public frontend configuration such as `VITE_API_URL` is safe to expose because it is browser-visible by design.
- Cognito ID tokens are stored in browser local storage for the preview. A hardened enterprise version should evaluate httpOnly session cookies or a managed auth provider flow.
- `upload_token_sha256` remains supported for owner-style emergency/manual access, but Cognito staff auth is the preferred upload path.

## Current Limitations

- No enterprise SSO/SAML yet.
- No multi-tenant account isolation; use one customer per AWS environment.
- No automated PHI/PII moderation claim.
- No legal hold or retention workflow beyond S3/DynamoDB lifecycle configuration and pilot offboarding.
- No formal penetration test, SOC 2, HIPAA attestation, or BAA.

## Hardening Checklist Before A Real Hospital Deployment

1. Complete buyer security and legal review.
2. Use a dedicated AWS account or isolated environment per customer.
3. Confirm Cognito password policy, MFA, and user lifecycle requirements.
4. Add enterprise SSO if required.
5. Add automated sensitive-content checks before human review if patient-identifying content is possible.
6. Define retention, deletion, export, legal hold, and incident response procedures.
7. Run dependency scanning and infrastructure policy checks in CI.
8. Validate CloudWatch alarms and dashboard after deployment.
