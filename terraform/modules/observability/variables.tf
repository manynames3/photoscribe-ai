variable "alert_email" {
  description = "Billing alarm subscription email."
  type        = string
}

variable "billing_alarm_threshold" {
  description = "Estimated monthly charge threshold in USD."
  type        = number
}

variable "ingest_log_group_name" {
  description = "CloudWatch log group name for the ingest Lambda."
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

