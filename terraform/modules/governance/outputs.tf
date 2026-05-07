output "asset_policy_table_arn" {
  description = "ARN of the DynamoDB asset policy table."
  value       = aws_dynamodb_table.asset_policy.arn
}

output "asset_policy_table_name" {
  description = "Name of the DynamoDB asset policy table."
  value       = aws_dynamodb_table.asset_policy.name
}

output "audit_log_table_arn" {
  description = "ARN of the DynamoDB audit log table."
  value       = aws_dynamodb_table.audit_log.arn
}

output "audit_log_table_name" {
  description = "Name of the DynamoDB audit log table."
  value       = aws_dynamodb_table.audit_log.name
}
