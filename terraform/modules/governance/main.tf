resource "aws_dynamodb_table" "asset_policy" {
  name         = "${var.name_prefix}-asset-policy"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "asset_key"

  attribute {
    name = "asset_key"
    type = "S"
  }

  attribute {
    name = "review_status"
    type = "S"
  }

  global_secondary_index {
    hash_key        = "review_status"
    name            = "review-status-index"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "audit_log" {
  name         = "${var.name_prefix}-audit-log"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"

  attribute {
    name = "event_id"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = merge(var.tags, {
    RetentionDays = tostring(var.audit_retention_days)
  })
}
