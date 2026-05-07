# ADR 0006: Add optional auth and governance controls

## Status

Accepted.

## Context

The public portfolio demo should stay easy to view, but a credible media asset platform needs private-library controls. Search results include signed image URLs, so access decisions must happen before the URL is generated. The system also needs a lightweight review and audit trail without adding always-on services or paid SaaS dependencies.

## Decision

Add optional Cognito User Pool authentication for the search API through an API Gateway JWT authorizer. Keep it disabled by default for the public demo. Add DynamoDB tables for asset policy metadata and search audit records. Ingest creates or updates asset policy rows while preserving human review decisions. Search checks review status, visibility, and allowed groups before returning signed URLs, then writes an audit event with TTL-based retention.

## Consequences

The app now has a production-ready path for private deployments without breaking the public demo. DynamoDB on-demand billing keeps idle cost low. The review workflow is policy-table based; a full reviewer/admin UI is still future work. Enabling Cognito auth requires adding a real browser login/token flow or another trusted way to place a JWT in the frontend session.
