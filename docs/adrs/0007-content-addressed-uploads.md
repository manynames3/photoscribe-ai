# ADR 0007: Use content-addressed browser uploads

## Status

Accepted.

## Context

The browser upload workflow sends user-selected images directly to private S3 through pre-signed URLs. Bulk uploads can accidentally include duplicate files, and each duplicate S3 object would trigger the ingest Lambda, Bedrock image description, Titan embedding, and vector writes again.

The development AWS account also has a low Lambda concurrency limit. During a bulk upload, many S3 object-created events can invoke the ingest Lambda at the same time and throttle the search/upload Lambda that issues pre-signed URLs.

## Decision

Compute a SHA-256 checksum in the browser before requesting a pre-signed URL. Use that checksum to derive a deterministic S3 key under `uploads/sha256/`. The upload API checks whether the object already exists before generating a signed `PUT` URL. If it exists, the API returns `duplicate: true` and the browser skips the upload.

Buffer S3 object-created events through SQS and cap the Lambda event-source mapping concurrency so image indexing cannot consume all available account concurrency.

## Consequences

- Exact duplicate files are skipped before creating another S3 object or triggering another Bedrock ingest.
- Upload behavior is easier to reason about because the same file maps to the same object key.
- The frontend must read each file once to compute a hash before upload.
- This only detects byte-identical duplicates. Visually similar files, resized images, and different encodings still need perceptual duplicate detection in a future version.
- SQS buffering protects API availability, but it can slow indexing during large batches.
