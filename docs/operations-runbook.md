# Operations Runbook

This runbook covers common pilot operations for a single CareFrame AWS environment.

## Daily Pilot Check

1. Confirm the Cloudflare Pages site loads.
2. Confirm `/app` can search either preview data or the connected private library.
3. Check CloudWatch alarms are in `OK` state.
4. Check the ingest DLQ has zero visible messages.
5. Search for a known approved asset.
6. Confirm review queue loads for an admin or reviewer user.

## Failed Upload

Symptoms:

- browser upload shows a network or 5xx error
- upload never appears in review queue

Checks:

1. Confirm the user is signed in and belongs to an upload-capable Cognito group.
2. Confirm the file is JPEG, PNG, or WebP and smaller than `max_upload_bytes`.
3. Check API Gateway and search Lambda logs for `/uploads/presign`.
4. Confirm the S3 bucket CORS origin matches the deployed frontend URL.
5. Retry the same file; exact duplicates should be skipped by SHA-256.

## Failed Ingest

Symptoms:

- upload succeeds, but asset never appears in review queue or search
- ingest Lambda error alarm fires
- DLQ has messages

Checks:

1. Open the ingest Lambda log stream and search for `ingest failed`.
2. Check Bedrock model access for Nova Lite and Titan Embeddings in the deployed region.
3. Confirm the object content type is supported.
4. Confirm S3 Vectors index exists and IAM allows `s3vectors:PutVectors`.
5. Inspect the DLQ message body to identify the original S3 event.
6. Replay the event only after fixing the root cause.

## Run The SQS Ingest Worker

The queue consumer is an AWS Lambda event-source mapping, not an application
polling loop. Lambda owns the `ReceiveMessage` calls and idle polling, so sleep
or jitter inside the handler cannot reduce empty receives. Terraform sets
20-second long polling on the source queue and DLQ, and keeps the mapping
disabled by default in `dev`, `development`, and `local` environments.

Enable the development worker only while exercising photo ingest:

```bash
terraform -chdir=terraform plan \
  -var-file=envs/dev.tfvars \
  -var-file=envs/dev.cloudflare.tfvars \
  -var='enable_sqs_worker=true' \
  -out=plan.tfplan
terraform -chdir=terraform apply plan.tfplan
terraform -chdir=terraform output -raw sqs_worker_enabled
```

After the ingest session, repeat the reviewed plan and apply with
`enable_sqs_worker=false`. Messages remain in the source queue for four days
while the mapping is disabled. Successful batch-size-one invocations delete
their message; failures are retried and eventually sent to the existing DLQ.

Verify idle usage in CloudWatch with `AWS/SQS` -> `NumberOfEmptyReceives`, the
`QueueName` dimension, statistic `Sum`, and period `1 day`. The CLI equivalent
for June 2026 is:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name NumberOfEmptyReceives \
  --dimensions Name=QueueName,Value=photoscribe-dev-ingest-queue \
  --start-time 2026-06-01T00:00:00Z \
  --end-time 2026-07-01T00:00:00Z \
  --period 86400 \
  --statistics Sum
```

After disabling the mapping, daily empty receives should fall to zero unless a
consumer outside this Terraform stack is polling the queue. Non-empty Lambda
invocations log the queue ARN, batch size, 20-second wait, and Lambda-managed
idle behavior.

## Thumbnail Failure

Symptoms:

- search works, but result cards use larger original images or placeholders
- logs show `thumbnail generation failed`

Checks:

1. Confirm the ingest package includes Pillow.
2. Confirm the image is readable and not corrupt.
3. Confirm ingest IAM allows `s3:PutObject` under `thumbnails/*`.
4. Re-upload or replay the ingest event if a thumbnail is required.

## Search Irrelevance

Symptoms:

- search results are unrelated
- good assets do not appear

Checks:

1. Confirm the asset has completed ingest.
2. Search by known curator tag or staff member name.
3. Lower `max_vector_distance` if irrelevant nearest-neighbor matches are appearing.
4. Add human-curated tags for buyer-critical searches.
5. Re-index if the metadata prompt or image model changes materially.

## Auth Or Permission Issue

Symptoms:

- staff sees 401 or 403
- upload/review/admin action unavailable

Checks:

1. Sign out and sign in again to refresh the Cognito token.
2. Confirm the user is in the expected Cognito group.
3. Confirm API Gateway authorizer audience and issuer match Terraform outputs.
4. Confirm the asset policy allows the user's group for restricted assets.

## Cost Alert

Symptoms:

- AWS billing alarm fires
- Bedrock spend higher than expected

Actions:

1. Pause large uploads.
2. Check recent upload volume and duplicate rates.
3. Confirm the model is Nova Lite unless intentionally testing Nova Pro or Claude.
4. Check whether failed ingest retries are repeatedly invoking Bedrock.
5. Lower upload limits or temporarily remove upload-capable users.

## Smoke Test

Run:

```bash
PHOTOSCRIBE_API_URL="$(terraform -chdir=terraform output -raw search_api_url)" \
PHOTOSCRIBE_AUTH_TOKEN="<cognito-id-token>" \
./scripts/smoke-test.sh
```

Optional upload:

```bash
PHOTOSCRIBE_API_URL="$(terraform -chdir=terraform output -raw search_api_url)" \
PHOTOSCRIBE_AUTH_TOKEN="<cognito-id-token>" \
PHOTOSCRIBE_PHOTO_PATH="./sample.jpg" \
PHOTOSCRIBE_SMOKE_QUERY="hospital executive headshot" \
./scripts/smoke-test.sh
```
