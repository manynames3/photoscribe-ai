# ADR 0008: Add low-cost operational guardrails

## Status

Accepted

## Context

A production-style cloud portfolio project should show how failures are surfaced and isolated. At the same time, PhotoScribe is designed to stay inexpensive at portfolio scale, so adding always-on observability platforms, dashboards, or persistent workers would work against the cost goal.

## Decision

Use SQS redrive to move failed ingest events to a dead-letter queue after retries. Add Terraform-managed CloudWatch alarms for Lambda errors, API Gateway 5xx responses, SQS queue age, and dead-letter queue messages. Reuse the existing SNS email topic used by the billing alarm.

## Consequences

- Failed ingest events are retained for inspection instead of being retried forever or silently dropped.
- The repo demonstrates operational awareness without adding always-on infrastructure.
- Alarm notifications are intentionally coarse-grained for portfolio scale.
- A production enterprise deployment would likely add centralized log analytics, tracing, dashboards, and incident routing.
