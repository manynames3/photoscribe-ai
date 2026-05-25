output "photo_bucket_name" {
  description = "S3 bucket storing uploaded photos."
  value       = module.storage.photo_bucket_name
}

output "photo_bucket_arn" {
  description = "ARN of the S3 photo bucket."
  value       = module.storage.photo_bucket_arn
}

output "vector_bucket_name" {
  description = "S3 Vectors bucket name."
  value       = module.vectors.vector_bucket_name
}

output "vector_index_arn" {
  description = "ARN of the S3 Vectors index."
  value       = module.vectors.vector_index_arn
}

output "search_api_url" {
  description = "Base URL for the HTTP search API."
  value       = module.search.api_url
}

output "api_auth_enabled" {
  description = "Whether the search API requires Cognito JWT authentication."
  value       = var.enable_api_auth
}

output "asset_policy_table_name" {
  description = "DynamoDB table storing asset review and access policy metadata."
  value       = module.governance.asset_policy_table_name
}

output "audit_log_table_name" {
  description = "DynamoDB table storing search audit records."
  value       = module.governance.audit_log_table_name
}

output "cognito_user_pool_client_id" {
  description = "Cognito app client ID when API auth is enabled."
  value       = try(module.auth[0].user_pool_client_id, "")
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID when API auth is enabled."
  value       = try(module.auth[0].user_pool_id, "")
}

output "cloudwatch_dashboard_name" {
  description = "Optional CloudWatch operations dashboard name when enabled."
  value       = module.observability.dashboard_name
}

output "frontend_bucket" {
  description = "S3 bucket storing the built frontend assets."
  value       = try(module.frontend[0].bucket_name, "")
}

output "frontend_distribution_id" {
  description = "CloudFront distribution ID serving the frontend."
  value       = try(module.frontend[0].distribution_id, "")
}

output "frontend_url" {
  description = "Public URL of the frontend distribution."
  value       = try(module.frontend[0].frontend_url, "")
}
