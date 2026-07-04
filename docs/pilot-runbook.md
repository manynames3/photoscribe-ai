# CareFrame Pilot Runbook

This runbook describes how to run a controlled CareFrame pilot for one hospital media library. It is intentionally scoped for a managed pilot, not a self-serve multi-tenant SaaS launch.

## Pilot Scope

- One customer or department group per deployed AWS environment.
- One private S3 media library.
- Invited staff users only through Cognito.
- Approved hospital marketing, communications, HR, facilities, and event photos only.
- No clinical decision support, diagnosis, patient charting, or regulated medical workflow.
- No HIPAA or BAA claim is made by this project. Use de-identified or approved media unless a production compliance review and BAA are in place.

## Pre-Pilot Checklist

1. Confirm the public landing page loads.
2. Confirm `/app` loads without exposing search, filters, result cards, signed image links, upload controls, review queue, or admin actions while signed out.
3. Confirm a Cognito admin or reviewer user can sign in.
4. Run the frontend preview searches: `hospital executive headshot`, `community health event`, and `hospital facilities documentation`.
5. Open one result and confirm the modal shows end-user fields: recommended use, department, consent, rights, campaign, staff member, and location.
6. Confirm a test upload enters the review queue before broad release.
7. Confirm a reviewer can update consent, rights, visibility, review status, owner department, campaign, and location.
8. Confirm an admin can invite a staff user and assign the expected role groups.

## Deployment Setup

Use the README deployment steps to provision the AWS backend and Cloudflare Pages frontend.

Required deployment controls:

- `enable_api_auth = true`
- `default_review_status = "pending_review"`
- `missing_asset_policy_default = "deny"`
- S3 public access blocked
- Cognito staff groups configured
- CloudWatch log retention enabled
- Billing and ingest failure alarms confirmed through SNS email subscription

## Staff Roles

Recommended pilot roles:

- `admin`: invite staff, configure role groups, manage broad access.
- `reviewer`: approve, restrict, or update asset policy fields.
- `marketing`: search and reuse approved campaign assets.
- `hr`: search headshots and employee media.
- `compliance`: inspect release, consent, rights, and visibility fields.
- `facilities`: search and organize campus, interior, renovation, and operations imagery.

Start with the smallest number of users needed to prove the workflow.

## Data Handling Rules

- Upload only approved media or synthetic/sample assets during pilot walkthroughs.
- Do not upload patient-identifying images unless the environment has passed the buyer's security, legal, and compliance review.
- Keep object names, staff names, and campaign metadata appropriate for the pilot audience.
- Use the review queue before making new uploads broadly searchable.
- Use expiration dates and `restricted` visibility for assets that should not be reused broadly.
- Delete pilot assets when the pilot ends unless the buyer explicitly requests retention.

## Runtime Flow

1. Staff uploads images through the browser.
2. The browser computes a SHA-256 hash and skips exact duplicates.
3. The app requests a signed S3 upload URL from the authenticated API.
4. S3 emits an event to SQS.
5. The ingest Lambda reads the image, generates metadata with Bedrock Nova Lite, embeds the description with Titan Embeddings, and writes S3 Vectors plus DynamoDB policy rows.
6. New assets start in `pending_review`.
7. Reviewers add human context such as department, consent, usage rights, staff member, campaign, location, and release readiness.
8. Approved assets become discoverable through natural-language search based on policy rules.

## Cost Guardrails

- Use Nova Lite as the default ingest model.
- Batch sample images before upload and avoid repeated re-ingest.
- Use SHA-256 duplicate detection before S3 upload.
- Keep pilots to a defined image count, such as 100-1,000 assets.
- Monitor Bedrock, Lambda errors, DLQ depth, and monthly AWS spend.
- Confirm SNS billing alerts are subscribed before uploading large batches.

## Pilot Acceptance Criteria

A pilot is successful when the buyer can:

- Find a known asset without knowing the filename or folder.
- Reuse an approved asset instead of recreating or reshooting it.
- Identify consent, rights, department owner, and release readiness before use.
- Route new uploads through review before broader library access.
- Explain who should own the workflow after the pilot.

## End-User QA Script

Run this with a real deployed backend before handing the workspace to non-technical staff:

1. Signed-out visitor opens `/app` and sees only the private-library access gate.
2. Staff user signs in and sees search, filters, result shortcuts, and staff tools appropriate to their role.
3. Staff user searches for a known approved asset and opens the detail modal.
4. Staff user confirms consent, usage rights, owner department, visibility, and recommended use before reuse.
5. Staff user uploads one approved test image and sees clear duplicate/upload feedback.
6. Reviewer loads the review queue and opens the uploaded asset.
7. Reviewer updates policy fields, saves, and confirms the asset appears in search with the new metadata.
8. Admin invites a test user, assigns a role group, and confirms the account can sign in.
9. Operator checks CloudWatch alarms, DLQ depth, API errors, Lambda errors, and billing alert subscription.
10. Operator runs `scripts/smoke-test.sh` with search, upload, policy update, and invite environment variables.

Do not proceed to real customer media until this QA script passes and the buyer has approved the data-handling rules.

## Offboarding

At pilot end:

1. Export or document any asset metadata the buyer wants to keep.
2. Disable Cognito staff users.
3. Delete S3 media objects if retention is not approved.
4. Delete DynamoDB policy and audit rows if retention is not approved.
5. Destroy the isolated pilot environment with Terraform when it is no longer needed.
