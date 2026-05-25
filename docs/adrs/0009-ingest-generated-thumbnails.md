# ADR 0009: Generate private thumbnails during ingest

## Status

Accepted

## Context

The UI originally rendered signed URLs for original uploaded objects. That works for a prototype, but it makes result grids slower, less polished, and more expensive in bandwidth for large image libraries.

## Decision

Generate a deterministic WebP thumbnail during the ingest Lambda flow and store it under `thumbnails/` in the private S3 photo bucket. Store the thumbnail key in the DynamoDB asset policy row. Search responses return a signed thumbnail URL when available and fall back to the original signed URL for legacy assets.

## Consequences

- Result cards can load smaller preview images.
- Original objects remain private and are still available through signed URLs.
- Ingest has one additional S3 `PutObject` and a small amount of image processing work.
- Generated thumbnail events are filtered/skipped so they do not trigger recursive ingest.
- Corrupt or unsupported images can still fail thumbnail generation; search falls back to originals when no thumbnail key exists.

