# Observability

CareFrame uses low-cost CloudWatch alarms by default and an optional CloudWatch dashboard for portfolio/pilot evidence.

## Default Alarms

Terraform provisions these alerts when `enable_operational_alarms = true`:

- monthly AWS billing threshold
- ingest Lambda errors
- search Lambda errors
- API Gateway 5xx responses
- SQS ingest queue age
- ingest dead-letter queue visible messages

The billing/SNS email subscription must be confirmed before alarm emails are delivered.

## Optional Dashboard

Set this Terraform variable to create a CloudWatch dashboard:

```hcl
enable_operational_dashboard = true
```

The dashboard includes:

- Lambda invocations and errors
- API request count, 4xx, 5xx, and p95 latency
- ingest queue age, queued messages, DLQ messages, and empty receives
- Lambda p95 duration and throttles
- recent ingest and search failure log queries

CloudWatch dashboards can add a small monthly AWS charge, so the dashboard is disabled by default for the lowest-cost portfolio deployment.

After enabling it, use this output:

```bash
terraform -chdir=terraform output -raw cloudwatch_dashboard_name
```

## Manual Evidence To Capture

For a hiring-manager portfolio walkthrough, capture screenshots of:

- the CloudWatch operations dashboard
- the Lambda logs showing an `indexed` ingest event
- the SQS DLQ alarm in OK state
- the billing alarm SNS subscription confirmed
- the GitHub Actions deploy workflow passing

Do not include AWS account IDs, tokens, email addresses, or private object keys in public screenshots.

## Failure Signals

- `ingest failed` in ingest Lambda logs means a photo did not complete metadata/vector indexing.
- `thumbnail generation failed` means search can still work, but the UI may fall back to original signed images.
- DLQ messages mean an S3 event failed repeatedly and needs replay or investigation.
- API 401/403 responses usually mean expired login or insufficient role group.
- API 5xx responses usually mean a Lambda, Bedrock, DynamoDB, or S3 Vectors issue.
