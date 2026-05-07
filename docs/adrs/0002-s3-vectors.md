# ADR 0002: Use S3 Vectors for semantic search

## Status

Accepted

## Context

The project needs vector search for photo descriptions, but a managed OpenSearch Serverless collection would be expensive for a low-volume portfolio demo. The data model is simple: one vector per photo, plus metadata filters.

## Decision

Use Amazon S3 Vectors for the vector bucket and `photos` index, with 1024-dimensional float vectors and cosine distance. Provision the resources through the `awscc` Terraform provider.

## Consequences

- The project avoids always-on vector database cost.
- The infrastructure remains AWS-native and simple to explain.
- The implementation depends on newer AWS service coverage.
- S3 Vectors is a better fit for this demo than for complex analytics or multi-tenant search features.
