variable "audit_retention_days" {
  description = "Number of days to retain audit records before DynamoDB TTL expiry."
  type        = number
}

variable "name_prefix" {
  description = "Name prefix for governance tables."
  type        = string
}

variable "tags" {
  description = "Tags applied to governance resources."
  type        = map(string)
}
