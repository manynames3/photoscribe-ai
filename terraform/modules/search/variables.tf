variable "account_id" {
  description = "AWS account ID."
  type        = string
}

variable "asset_policy_table_arn" {
  description = "ARN of the DynamoDB asset policy table."
  type        = string
}

variable "asset_policy_table_name" {
  description = "Name of the DynamoDB asset policy table."
  type        = string
}

variable "audit_log_table_arn" {
  description = "ARN of the DynamoDB audit log table."
  type        = string
}

variable "audit_log_table_name" {
  description = "Name of the DynamoDB audit log table."
  type        = string
}

variable "audit_log_retention_days" {
  description = "Number of days search audit records are retained."
  type        = number
}

variable "cognito_audience" {
  description = "JWT audiences accepted by API Gateway."
  type        = list(string)
}

variable "cognito_issuer" {
  description = "JWT issuer accepted by API Gateway."
  type        = string
}

variable "embed_model_id" {
  description = "Titan embedding model ID."
  type        = string
}

variable "enable_api_auth" {
  description = "Whether the API Gateway route requires JWT authentication."
  type        = bool
}

variable "frontend_origins" {
  description = "Allowed CORS origins."
  type        = list(string)
}

variable "lambda_name" {
  description = "Name of the search Lambda function."
  type        = string
}

variable "lambda_source_dir" {
  description = "Path to the Lambda source code directory."
  type        = string
}

variable "max_upload_bytes" {
  description = "Maximum browser upload size in bytes."
  type        = number
}

variable "missing_asset_policy_default" {
  description = "Search behavior for assets without a policy row."
  type        = string
}

variable "partition" {
  description = "AWS partition."
  type        = string
}

variable "photo_bucket_arn" {
  description = "ARN of the primary photo bucket."
  type        = string
}

variable "photo_bucket_name" {
  description = "Name of the primary photo bucket."
  type        = string
}

variable "region" {
  description = "AWS region."
  type        = string
}

variable "tags" {
  description = "Tags applied to search resources."
  type        = map(string)
}

variable "upload_token_sha256" {
  description = "SHA-256 hash of the owner upload token. Empty disables browser uploads."
  type        = string
  sensitive   = true
}

variable "vector_bucket_name" {
  description = "S3 Vectors bucket name."
  type        = string
}

variable "vector_index_arn" {
  description = "S3 Vectors index ARN."
  type        = string
}

variable "vector_index_name" {
  description = "S3 Vectors index name."
  type        = string
}
