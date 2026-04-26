variable "account_id" {
  description = "AWS account ID."
  type        = string
}

variable "dimension" {
  description = "Vector dimension."
  type        = number
}

variable "distance_metric" {
  description = "Distance metric for similarity search."
  type        = string
}

variable "index_name" {
  description = "Vector index name."
  type        = string
}

variable "non_filterable_metadata_keys" {
  description = "Metadata keys configured as non-filterable."
  type        = list(string)
}

variable "partition" {
  description = "AWS partition."
  type        = string
}

variable "region" {
  description = "AWS region."
  type        = string
}

variable "tags" {
  description = "AWSCC-compatible tag list."
  type = list(object({
    key   = string
    value = string
  }))
}

variable "vector_bucket_name" {
  description = "Vector bucket name."
  type        = string
}

