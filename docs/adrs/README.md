# Architecture Decision Records

This directory records the main architecture choices behind PhotoScribe AI.

## ADR Index

- [ADR 0001: Use serverless AWS for the backend](0001-serverless-aws-backend.md)
- [ADR 0002: Use S3 Vectors for semantic search](0002-s3-vectors.md)
- [ADR 0003: Use Bedrock Nova Lite and Titan embeddings](0003-bedrock-nova-titan.md)
- [ADR 0004: Host the frontend on Cloudflare Pages](0004-cloudflare-pages.md)
- [ADR 0005: Use pre-signed S3 URLs for preview image access](0005-presigned-s3-urls.md)
- [ADR 0006: Use Cognito auth and governance controls](0006-optional-auth-governance.md)
- [ADR 0007: Use content-addressed browser uploads](0007-content-addressed-uploads.md)
- [ADR 0008: Add low-cost operational guardrails](0008-low-cost-operational-guardrails.md)
- [ADR 0009: Generate private thumbnails during ingest](0009-ingest-generated-thumbnails.md)
- [ADR 0010: Preserve staff task state and asset permissions](0010-role-aware-staff-workspace.md)
- [ADR 0011: Keep the managed pilot operational and verify releases](0011-verified-managed-pilot-releases.md)
- [ADR 0012: Complete curated search before applying its result limit](0012-paginate-curated-search.md)

## Format

Each ADR uses:

- Title
- Status
- Context
- Decision
- Consequences
