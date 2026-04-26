variable "photo_bucket_name" {
  description = "Name of the primary S3 photo bucket."
  type        = string
}

variable "tags" {
  description = "Tags applied to all storage resources."
  type        = map(string)
}

