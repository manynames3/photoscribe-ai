#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap-remote-state.sh [region]

Creates:
  - S3 bucket:    photoscribe-tfstate-<account-id>-<region>
  - Dynamo table: photoscribe-tflock

Also writes terraform/dev.backend.hcl for terraform init.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

REGION="${1:-${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
STATE_BUCKET="photoscribe-tfstate-${ACCOUNT_ID}-${REGION}"
LOCK_TABLE="photoscribe-tflock"
BACKEND_FILE="terraform/dev.backend.hcl"

aws s3api create-bucket \
  --bucket "${STATE_BUCKET}" \
  --region "${REGION}" \
  $(if [[ "${REGION}" != "us-east-1" ]]; then printf '%s' "--create-bucket-configuration LocationConstraint=${REGION}"; fi) \
  >/dev/null 2>&1 || true

aws s3api put-bucket-versioning \
  --bucket "${STATE_BUCKET}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${STATE_BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }
    ]
  }'

aws dynamodb create-table \
  --table-name "${LOCK_TABLE}" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "${REGION}" \
  >/dev/null 2>&1 || true

mkdir -p terraform
cat > "${BACKEND_FILE}" <<EOF
bucket         = "${STATE_BUCKET}"
key            = "photoscribe/dev/terraform.tfstate"
region         = "${REGION}"
dynamodb_table = "${LOCK_TABLE}"
encrypt        = true
EOF

printf 'Created/verified remote state resources.\n'
printf 'Bucket: %s\n' "${STATE_BUCKET}"
printf 'Table: %s\n' "${LOCK_TABLE}"
printf 'Backend config: %s\n' "${BACKEND_FILE}"

