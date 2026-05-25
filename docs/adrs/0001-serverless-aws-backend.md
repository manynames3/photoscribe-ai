# ADR 0001: Use serverless AWS for the backend

## Status

Accepted

## Context

PhotoScribe needs to process photo uploads, call managed AI services, expose a search API, and stay inexpensive at portfolio scale. The workload is bursty: ingest happens when photos are uploaded, and search traffic is expected to be low to moderate.

## Decision

Use AWS Lambda, Amazon API Gateway, Amazon S3, EventBridge, CloudWatch, and Terraform-managed IAM instead of running a persistent server or container cluster.

## Consequences

- Idle cost stays low because compute is request-driven.
- AWS IAM can be scoped per function.
- Cold starts are acceptable for a preview and portfolio workload.
- Long-running batch jobs or high sustained traffic would need additional design work.
