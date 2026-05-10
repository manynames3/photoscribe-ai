variable "alert_email" {
  description = "Billing alarm subscription email."
  type        = string
}

variable "billing_alarm_threshold" {
  description = "Estimated monthly charge threshold in USD."
  type        = number
}

variable "enable_operational_alarms" {
  description = "Whether to provision low-cost operational CloudWatch alarms."
  type        = bool
}

variable "ingest_dlq_name" {
  description = "SQS dead-letter queue name for failed ingest events."
  type        = string
}

variable "ingest_lambda_name" {
  description = "Ingest Lambda function name."
  type        = string
}

variable "ingest_log_group_name" {
  description = "CloudWatch log group name for the ingest Lambda."
  type        = string
}

variable "ingest_queue_name" {
  description = "SQS queue name for ingest events."
  type        = string
}

variable "search_api_id" {
  description = "API Gateway HTTP API ID for search and asset routes."
  type        = string
}

variable "search_api_stage_name" {
  description = "API Gateway HTTP API stage name."
  type        = string
}

variable "search_lambda_name" {
  description = "Search Lambda function name."
  type        = string
}

variable "search_log_group_name" {
  description = "CloudWatch log group name for the search Lambda."
  type        = string
}

variable "tags" {
  description = "Tags applied to observability resources."
  type        = map(string)
}
