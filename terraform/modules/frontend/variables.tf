variable "bucket_name" {
  description = "Static site bucket name."
  type        = string
}

variable "tags" {
  description = "Tags applied to frontend resources."
  type        = map(string)
}
