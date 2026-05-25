#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  PHOTOSCRIBE_API_URL=https://api.example.com \
  PHOTOSCRIBE_AUTH_TOKEN=<cognito-id-token> \
  ./scripts/smoke-test.sh

Optional upload smoke:
  PHOTOSCRIBE_API_URL=https://api.example.com \
  PHOTOSCRIBE_AUTH_TOKEN=<cognito-id-token> \
  PHOTOSCRIBE_PHOTO_PATH=./sample.jpg \
  PHOTOSCRIBE_SMOKE_QUERY="sample photo description" \
  ./scripts/smoke-test.sh

Required tools: curl, jq, python3, shasum, wc
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$1"
}

content_type_for_file() {
  case "${1,,}" in
    *.jpg | *.jpeg) printf 'image/jpeg' ;;
    *.png) printf 'image/png' ;;
    *.webp) printf 'image/webp' ;;
    *)
      echo "Unsupported smoke-test image type. Use JPEG, PNG, or WebP." >&2
      exit 1
      ;;
  esac
}

api_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local args=(-fsS -X "$method")

  if [[ -n "${PHOTOSCRIBE_AUTH_TOKEN:-}" ]]; then
    args+=(-H "Authorization: Bearer ${PHOTOSCRIBE_AUTH_TOKEN}")
  fi

  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi

  curl "${args[@]}" "$url"
}

require_command curl
require_command jq
require_command python3
require_command shasum
require_command wc

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

: "${PHOTOSCRIBE_API_URL:?Set PHOTOSCRIBE_API_URL to the deployed API Gateway base URL.}"

api_url="${PHOTOSCRIBE_API_URL%/}"
query="${PHOTOSCRIBE_SMOKE_QUERY:-hospital executive headshot}"

echo "1. Running search smoke for query: ${query}"
search_response="$(api_json GET "${api_url}/search?q=$(urlencode "$query")")"
echo "$search_response" | jq '{message, query, result_count: (.results | length), denied_results: .security_context.denied_results}'

if [[ -z "${PHOTOSCRIBE_PHOTO_PATH:-}" ]]; then
  echo "2. Upload smoke skipped. Set PHOTOSCRIBE_PHOTO_PATH to test upload, ingest, and review queue."
  exit 0
fi

photo_path="$PHOTOSCRIBE_PHOTO_PATH"
if [[ ! -f "$photo_path" ]]; then
  echo "Photo path does not exist: $photo_path" >&2
  exit 1
fi

echo "2. Requesting signed upload URL for: ${photo_path}"
checksum="$(shasum -a 256 "$photo_path" | awk '{print $1}')"
size_bytes="$(wc -c < "$photo_path" | tr -d ' ')"
content_type="$(content_type_for_file "$photo_path")"
filename="$(basename "$photo_path")"

presign_body="$(jq -n \
  --arg checksum "$checksum" \
  --arg content_type "$content_type" \
  --arg filename "$filename" \
  --argjson size_bytes "$size_bytes" \
  '{checksum_sha256: $checksum, content_type: $content_type, filename: $filename, size_bytes: $size_bytes}')"

presign_response="$(api_json POST "${api_url}/uploads/presign" "$presign_body")"
echo "$presign_response" | jq '{bucket, key, duplicate}'

if [[ "$(echo "$presign_response" | jq -r '.duplicate // false')" != "true" ]]; then
  upload_url="$(echo "$presign_response" | jq -r '.upload_url')"
  echo "3. Uploading object to private S3 with signed URL."
  curl -fsS \
    -X PUT \
    -H "Content-Type: ${content_type}" \
    -H "x-amz-meta-sha256: ${checksum}" \
    --upload-file "$photo_path" \
    "$upload_url" >/dev/null
else
  echo "3. Upload skipped because the object already exists."
fi

echo "4. Loading review queue."
review_response="$(api_json GET "${api_url}/assets/review")"
echo "$review_response" | jq '{message, pending_review_count: (.results | length)}'

echo "5. Polling search so ingest has time to finish."
attempts="${PHOTOSCRIBE_SMOKE_ATTEMPTS:-6}"
sleep_seconds="${PHOTOSCRIBE_SMOKE_SLEEP_SECONDS:-20}"
for attempt in $(seq 1 "$attempts"); do
  poll_response="$(api_json GET "${api_url}/search?q=$(urlencode "$query")")"
  result_count="$(echo "$poll_response" | jq '.results | length')"
  echo "Attempt ${attempt}/${attempts}: ${result_count} result(s)."
  if [[ "$result_count" -gt 0 ]]; then
    echo "$poll_response" | jq '{message, query, first_result: (.results[0] | {key, review_status, owner_department, thumbnail_url_present: (.thumbnail_url != null)})}'
    exit 0
  fi
  sleep "$sleep_seconds"
done

echo "Smoke test finished without a searchable result. Check CloudWatch ingest logs and DLQ." >&2
exit 1
