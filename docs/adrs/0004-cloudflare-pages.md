# ADR 0004: Host the frontend on Cloudflare Pages

## Status

Accepted

## Context

The frontend is a static Vite React application. AWS S3 and CloudFront hosting were implemented as an optional Terraform module, but the project benefits from a free, simple public hosting path for portfolio review.

## Decision

Host the public frontend on Cloudflare Pages and deploy it through GitHub Actions with Wrangler direct upload.

## Consequences

- The public demo is inexpensive and easy to share.
- GitHub Actions owns the deployment flow.
- The Cloudflare API token must be stored as a GitHub Actions secret.
- A direct-upload Pages project cannot be converted into Cloudflare Git integration later.
