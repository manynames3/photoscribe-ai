# ADR 0011: Keep The Managed Pilot Operational And Verify Releases

## Status

Accepted, 2026-10-13.

## Context

An idle-development default disabled the SQS worker in the deployed pilot, which
left staff uploads waiting to index. Unit tests alone also missed a clipped
review form and the role-list editing defect. Dependency audit findings needed
remediation without introducing a new application dependency.

## Decision

Keep `enable_sqs_worker = false` in base development configuration, but override
it to `true` in the existing Cloudflare managed-pilot deployment file. Plan with
both files and the actual alert contact; apply only an acknowledged saved plan.
Retain the existing worker concurrency limits, queue, DLQ, and alarms.

Allow exact, known frontend origins, including the existing local preview at
`http://127.0.0.1:5175`; do not use wildcard origins or disable authentication for
testing. Verify real Cognito, private upload, automatic ingest, review, rights,
and role behavior with disposable accounts and a non-sensitive public test image.
Remove test accounts and test storage/index/policy records afterward. Do not
change pre-existing staff assets or publish them in documentation.

Use a clean lockfile install and dependency audit before frontend deployment.
Keep backend coverage enforcement at the repository's 80% minimum. Publish
actual verification evidence and distinguish managed-pilot functionality from
unperformed customer security, legal, and regulated-data approvals.

## Consequences

The pilot can process uploads without operator intervention, but active polling
and image processing incur AWS charges. Operators must use the correct deployment
overrides; disabling the worker intentionally pauses ingest. Live verification
is more realistic than UI mocks, but does not establish email deliverability,
hospital SSO/MFA policy, regulatory compliance, or customer acceptance.
