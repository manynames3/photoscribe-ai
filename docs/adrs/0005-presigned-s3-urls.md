# ADR 0005: Use pre-signed S3 URLs for demo image access

## Status

Accepted

## Context

The photo bucket should not be public, but the React UI needs to display search result images. The project does not currently include user authentication or a thumbnail service.

## Decision

Keep the photo bucket private and have the search Lambda return short-lived pre-signed S3 URLs for matched objects.

## Consequences

- S3 public access can remain blocked.
- The UI can render images without proxying all bytes through Lambda.
- Demo photos should be treated as public-facing once indexed because the public search API can return signed URLs.
- A production private-photo product would need authentication, authorization, and probably a thumbnail pipeline.
