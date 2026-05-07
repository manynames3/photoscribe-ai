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

variable "claude_model_id" {
  description = "Claude multimodal model ID."
  type        = string
}

variable "default_allowed_groups" {
  description = "Default groups allowed to access restricted assets."
  type        = list(string)
}

variable "default_review_status" {
  description = "Default review status assigned to ingested assets."
  type        = string
}

variable "default_visibility" {
  description = "Default visibility assigned to ingested assets."
  type        = string
}

variable "embed_model_id" {
  description = "Titan embedding model ID."
  type        = string
}

variable "event_bucket_name" {
  description = "Bucket name that emits photo-created events."
  type        = string
}

variable "lambda_name" {
  description = "Name of the ingest Lambda function."
  type        = string
}

variable "lambda_source_dir" {
  description = "Path to the Lambda source code directory."
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

variable "region" {
  description = "AWS region."
  type        = string
}

variable "tags" {
  description = "Tags applied to ingest resources."
  type        = map(string)
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
