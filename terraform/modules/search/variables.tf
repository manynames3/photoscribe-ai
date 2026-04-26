variable "account_id" {
  description = "AWS account ID."
  type        = string
}

variable "embed_model_id" {
  description = "Titan embedding model ID."
  type        = string
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
