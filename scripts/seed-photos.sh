#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: ./scripts/seed-photos.sh <photo-directory> <bucket-name>"
  exit 1
fi

PHOTO_DIR="$1"
BUCKET_NAME="$2"

if [[ ! -d "${PHOTO_DIR}" ]]; then
  echo "Directory not found: ${PHOTO_DIR}"
  exit 1
fi

aws s3 sync "${PHOTO_DIR}" "s3://${BUCKET_NAME}/"

