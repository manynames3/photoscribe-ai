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
