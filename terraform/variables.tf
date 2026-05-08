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

variable "claude_model_id" {
  description = "Claude multimodal model ID for image description."
  type        = string
  default     = "us.anthropic.claude-sonnet-4-6"
}

variable "embed_model_id" {
  description = "Titan embeddings model ID for text embeddings."
  type        = string
  default     = "amazon.titan-embed-text-v2:0"
}

variable "enable_api_auth" {
  description = "Whether API Gateway requires Cognito JWT authentication for the search API."
  type        = bool
  default     = false
}

variable "library_role_names" {
  description = "Role names created as Cognito groups and used by Lambda policy checks."
  type        = list(string)
  default     = ["admin", "reviewer", "employee"]
}

variable "default_asset_review_status" {
  description = "Initial review status assigned to newly indexed assets."
  type        = string
  default     = "approved"

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
  default     = ["admin", "reviewer", "employee"]
}

variable "missing_asset_policy_default" {
  description = "Search behavior for assets that do not yet have a DynamoDB policy row."
  type        = string
  default     = "allow"

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
