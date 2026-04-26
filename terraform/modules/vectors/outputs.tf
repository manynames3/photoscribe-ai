output "vector_bucket_name" {
  value = var.vector_bucket_name
}

output "vector_bucket_arn" {
  value = "arn:${var.partition}:s3vectors:${var.region}:${var.account_id}:bucket/${var.vector_bucket_name}"
}

output "vector_index_arn" {
  value = "arn:${var.partition}:s3vectors:${var.region}:${var.account_id}:bucket/${var.vector_bucket_name}/index/${var.index_name}"
}

