variable "photo_bucket_name" {
  description = "Name of the primary S3 photo bucket."
  type        = string
}

variable "cors_allowed_origins" {
  description = "Origins allowed to upload directly to S3 with presigned URLs."
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to all storage resources."
  type        = map(string)
}
