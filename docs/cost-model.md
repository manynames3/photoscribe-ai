# Cost Model

PhotoScribe AI is designed for low-volume portfolio usage with minimal always-on infrastructure. The main costs are request-driven rather than server-based.

For a portfolio dataset of roughly 1,000 images and light search traffic, the non-AI infrastructure should stay very small because the design avoids always-on search clusters. The variable cost is image analysis during ingest. Actual spend depends on image count, model choice, generated token volume, search frequency, AWS Region, and whether free-tier credits apply.

Primary cost drivers:

- Bedrock Nova Lite image description during ingest.
- Bedrock Titan Text Embeddings during ingest and search.
- S3 Vectors storage and query requests.
- S3 photo object storage.
- S3 storage and PUT requests for generated WebP thumbnails.

Low-volume supporting costs:

- Lambda invocations and duration for ingest/search.
- HTTP API Gateway requests.
- DynamoDB on-demand reads/writes for asset policies and audit records.
- CloudWatch logs, metrics, and a small set of targeted operational alarms.
- Optional CloudWatch dashboard when `enable_operational_dashboard = true`.
- Billing alarm SNS notifications.
- Cognito User Pool usage only when `enable_api_auth = true`.

Cost controls in this repo:

- No always-on servers or managed vector database clusters.
- Private S3 objects are served through short-lived signed URLs.
- S3 ingest events are buffered through SQS with a dead-letter queue instead of adding an always-on worker.
- Audit logs use DynamoDB TTL so records expire automatically.
- Terraform provisions a development billing alarm and targeted failure alarms by default; the dashboard is optional because dashboards can add a small monthly charge.
- Generated thumbnails are small WebP derivatives and avoid repeatedly loading large originals in the UI.
- The public preview keeps the dataset intentionally small.

## Image Model Choice

Image metadata generation runs once per new uploaded image, so the model decision affects ingest cost more than search cost. Search does not re-run the multimodal model; it embeds the user's query with Titan and searches stored S3 Vectors.

The default image model is **Amazon Nova Lite**. It is the best fit for this project because the application needs useful descriptions, alt text, captions, and structured metadata rather than deep multi-step reasoning. Nova Lite is AWS-native, avoids the Anthropic account use-case approval blocker, and is materially cheaper than larger multimodal models.

**Nova Pro** is still affordable and can be used by changing `image_model_id`, but the expected quality improvement for this use case is not large enough to justify making it the default. It is a good fallback for higher-value ingest batches if Nova Lite metadata is too shallow.

**Claude** remains a premium option for high-performance or compliance-heavy review workflows where nuanced interpretation matters more than cost. It is not the default because it is substantially more expensive and can require additional Anthropic model access approval in Bedrock.

At current Bedrock on-demand rates in `us-east-1`, Nova Lite is priced at `$0.06` per 1M input tokens and `$0.24` per 1M output tokens. Nova Pro is `$0.80` per 1M input tokens and `$3.20` per 1M output tokens, making Nova Lite about **13.3x cheaper** for both input and output tokens. For roughly 200 portfolio images, Nova Lite should be in the pennies range, while Nova Pro should still be around cents to about a dollar depending on image/prompt size and output length.

## Why S3 Vectors

One blocker for enterprise media intelligence is vector infrastructure cost. Traditional OpenSearch or Elasticsearch-style architectures can be technically credible, but they introduce baseline compute cost before a single image is searched.

S3 Vectors fits this portfolio workload because it is request and storage driven. The project stores vectors alongside metadata and pays for vector storage, PUT volume, and query volume rather than running an always-on vector cluster.

## Comparison Point

AWS's OpenSearch pricing page includes an example where OpenSearch Serverless indexing and search OCUs contribute hundreds of dollars per month in baseline-style compute charges for an indexed dashboard workload. That is a different workload than PhotoScribe, but it illustrates the architectural tradeoff: OpenSearch is powerful for high-throughput search and analytics, while S3 Vectors is a better fit for low-volume semantic search where idle cost matters.

## Pricing References

- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/) covers S3 storage, request pricing, and S3 Vectors pricing.
- [Amazon OpenSearch Service pricing](https://aws.amazon.com/opensearch-service/pricing/) covers OpenSearch Serverless and OCU-based pricing examples.
- [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/) covers model-dependent inference pricing for Nova, Claude, and Titan.
