# Cost Model

PhotoScribe AI is designed for low-volume portfolio usage with minimal always-on infrastructure. The main costs are request-driven rather than server-based.

For a portfolio dataset of roughly 1,000 images and light search traffic, the non-AI infrastructure should stay very small because the design avoids always-on search clusters. The variable cost is image analysis during ingest. Actual spend depends on image count, model choice, generated token volume, search frequency, AWS Region, and whether free-tier credits apply.

Primary cost drivers:

- Bedrock Claude image description during ingest.
- Bedrock Titan Text Embeddings during ingest and search.
- S3 Vectors storage and query requests.
- S3 photo object storage.

Low-volume supporting costs:

- Lambda invocations and duration for ingest/search.
- HTTP API Gateway requests.
- DynamoDB on-demand reads/writes for asset policies and audit records.
- CloudWatch logs and metrics.
- Billing alarm SNS notifications.
- Cognito User Pool usage only when `enable_api_auth = true`.

Cost controls in this repo:

- No always-on servers or managed vector database clusters.
- Private S3 objects are served through short-lived signed URLs.
- Audit logs use DynamoDB TTL so records expire automatically.
- Terraform provisions a development billing alarm.
- The public demo keeps the dataset intentionally small.

## Why S3 Vectors

One blocker for enterprise media intelligence is vector infrastructure cost. Traditional OpenSearch or Elasticsearch-style architectures can be technically credible, but they introduce baseline compute cost before a single image is searched.

S3 Vectors fits this portfolio workload because it is request and storage driven. The project stores vectors alongside metadata and pays for vector storage, PUT volume, and query volume rather than running an always-on vector cluster.

## Comparison Point

AWS's OpenSearch pricing page includes an example where OpenSearch Serverless indexing and search OCUs contribute hundreds of dollars per month in baseline-style compute charges for an indexed dashboard workload. That is a different workload than PhotoScribe, but it illustrates the architectural tradeoff: OpenSearch is powerful for high-throughput search and analytics, while S3 Vectors is a better fit for low-volume semantic search where idle cost matters.

## Pricing References

- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/) covers S3 storage, request pricing, and S3 Vectors pricing.
- [Amazon OpenSearch Service pricing](https://aws.amazon.com/opensearch-service/pricing/) covers OpenSearch Serverless and OCU-based pricing examples.
- [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/) covers model-dependent inference pricing for Claude and Titan.
