# ADR 0003: Use Bedrock Claude and Titan embeddings

## Status

Accepted

## Context

The system needs two AI capabilities: image understanding during ingest and text embeddings for both image descriptions and user search queries. Keeping both inside AWS simplifies IAM, networking, and deployment.

## Decision

Use Amazon Bedrock Claude multimodal for image metadata generation and Amazon Titan Text Embeddings v2 for 1024-dimensional text embeddings.

## Consequences

- The application can generate rich metadata from images without a separate vision service.
- Query and document embeddings are produced by the same model family, which keeps search behavior consistent.
- Bedrock model access must be enabled per AWS account and region.
- Claude image analysis is the main variable cost in the system.
