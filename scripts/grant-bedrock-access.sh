#!/usr/bin/env bash

set -euo pipefail

cat <<'EOF'
Enable Bedrock model access in the AWS Console for:
  - anthropic.claude-3-5-sonnet-20241022-v2:0 or current approved Sonnet profile
  - amazon.titan-embed-text-v2:0

This helper is intentionally non-destructive in Phase 1.
EOF

