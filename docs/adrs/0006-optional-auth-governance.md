# ADR 0006: Use Cognito auth and governance controls

## Status

Accepted

## Context

The public portfolio preview should be easy to review, but a credible institutional media asset platform needs private-library controls by default. Search results include signed image URLs, so access decisions must happen before the URL is generated. The system also needs a lightweight review and audit trail without adding always-on services or paid SaaS dependencies.

## Decision

Use Cognito User Pool authentication for the asset API through an API Gateway JWT authorizer. Enable it by default in Terraform. Add DynamoDB tables for asset policy metadata and search audit records. Ingest creates or updates asset policy rows while preserving human review decisions. Search checks review status, visibility, and allowed groups before returning signed URLs, then writes an audit event with TTL-based retention.

## Consequences

The app now behaves like a private library by default. DynamoDB on-demand billing keeps idle cost low. The review workflow is policy-table based, with a DynamoDB `review_status` index for the review queue. Existing legacy assets need policy rows before they appear when missing policies are denied.
