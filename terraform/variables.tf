variable "env" {
  description = "Deployment environment name."
  type        = string
}

variable "region" {
  description = "AWS region for the workload."
  type        = string
  default     = "us-east-1"
}

variable "alert_email" {
  description = "Email address subscribed to the development billing alarm."
  type        = string

  validation {
    condition = (
      var.alert_email != "change-me@example.com" &&
      can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alert_email))
    )
    error_message = "Set alert_email to a real email address; do not apply the placeholder change-me@example.com."
  }
}

variable "frontend_origin" {
  description = "Origin allowed by the HTTP API CORS configuration."
  type        = string
}

variable "extra_frontend_origins" {
  description = "Additional allowed frontend origins, such as Cloudflare Pages preview or production domains."
  type        = list(string)
  default     = []
}

variable "enable_aws_frontend_hosting" {
  description = "Whether to provision the S3 and CloudFront frontend hosting stack."
  type        = bool
  default     = true
}

variable "billing_alarm_threshold" {
  description = "Monthly billing alarm threshold in USD."
  type        = number
  default     = 5
}

variable "image_model_id" {
  description = "Multimodal Bedrock model ID for image metadata generation."
  type        = string
  default     = "us.amazon.nova-lite-v1:0"
}

variable "embed_model_id" {
  description = "Titan embeddings model ID for text embeddings."
  type        = string
  default     = "amazon.titan-embed-text-v2:0"
}

variable "enable_api_auth" {
  description = "Whether API Gateway requires Cognito JWT authentication for the asset API."
  type        = bool
  default     = true
}

variable "library_role_names" {
  description = "Role names created as Cognito groups and used by Lambda policy checks."
  type        = list(string)
  default     = ["admin", "reviewer", "marketing", "hr", "compliance", "facilities"]
}

variable "default_asset_review_status" {
  description = "Initial review status assigned to newly indexed assets."
  type        = string
  default     = "pending_review"

  validation {
    condition     = contains(["approved", "pending_review", "rejected"], var.default_asset_review_status)
    error_message = "default_asset_review_status must be approved, pending_review, or rejected."
  }
}

variable "default_asset_visibility" {
  description = "Initial visibility assigned to newly indexed assets."
  type        = string
  default     = "library"

  validation {
    condition     = contains(["library", "restricted"], var.default_asset_visibility)
    error_message = "default_asset_visibility must be library or restricted."
  }
}

variable "default_asset_allowed_groups" {
  description = "Groups allowed to access assets when visibility is restricted."
  type        = list(string)
  default     = ["admin", "reviewer", "marketing", "hr", "compliance", "facilities"]
}

variable "missing_asset_policy_default" {
  description = "Search behavior for assets that do not yet have a DynamoDB policy row."
  type        = string
  default     = "deny"

  validation {
    condition     = contains(["allow", "deny"], var.missing_asset_policy_default)
    error_message = "missing_asset_policy_default must be allow or deny."
  }
}

variable "audit_log_retention_days" {
  description = "Number of days DynamoDB audit log records are retained."
  type        = number
  default     = 30
}

variable "upload_token_sha256" {
  description = "SHA-256 hash of the owner upload token. Leave empty to disable browser uploads."
  type        = string
  default     = ""
  sensitive   = true
}

variable "max_upload_bytes" {
  description = "Maximum browser upload size in bytes."
  type        = number
  default     = 15728640
}

variable "max_vector_distance" {
  description = "Maximum vector distance allowed in search results. Lower values reduce irrelevant nearest-neighbor matches."
  type        = number
  default     = 0.8
}

variable "ingest_event_source_max_concurrency" {
  description = "Maximum concurrent ingest Lambda invokes from the SQS event source. Keeps image indexing from starving upload/search API capacity."
  type        = number
  default     = 2
}

variable "enable_sqs_worker" {
  description = "Whether the SQS ingest event-source mapping is enabled. Defaults off in development environments and on elsewhere."
  type        = bool
  default     = null
  nullable    = true
}

variable "enable_operational_alarms" {
  description = "Whether to provision low-cost CloudWatch alarms for Lambda, API Gateway, and SQS failures."
  type        = bool
  default     = true
}

variable "enable_operational_dashboard" {
  description = "Whether to provision the optional CloudWatch dashboard. Dashboards can add a small monthly AWS charge."
  type        = bool
  default     = false
}
