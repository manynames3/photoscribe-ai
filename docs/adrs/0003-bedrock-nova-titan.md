# ADR 0003: Use Bedrock Nova Lite and Titan embeddings

## Status

Accepted

## Context

The system needs two AI capabilities: image understanding during ingest and text embeddings for both image descriptions and user search queries. Keeping both inside AWS simplifies IAM, networking, deployment, and portfolio explanation.

The image model runs once per uploaded image. Search does not call the image model again; it embeds the user's text query and searches stored vectors. This makes cost-effective ingest more important than choosing the strongest possible multimodal model for every asset.

## Decision

Use **Amazon Nova Lite** as the default multimodal model for image metadata generation and **Amazon Titan Text Embeddings v2** for 1024-dimensional text embeddings.

Keep the model configurable through Terraform `image_model_id` so the deployment can switch to Nova Pro or Claude when higher performance is worth the cost.

## Consequences

- Nova Lite is AWS-native and avoids the Anthropic model access/use-case approval blocker.
- Nova Lite is much cheaper than Nova Pro and Claude, which keeps portfolio-scale ingest costs very low.
- Nova Pro remains a practical upgrade path because it is still affordable, but the expected quality improvement is not large enough to justify using it by default.
- Claude remains available as a premium option for high-performance or compliance-heavy review workflows where nuanced interpretation matters more than cost.
- Query and document embeddings are produced by the same Titan model, which keeps semantic search behavior consistent.
- Image model changes require re-indexing existing assets if the generated metadata should be refreshed.
