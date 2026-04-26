output "photo_bucket_name" {
  description = "S3 bucket storing uploaded photos."
  value       = module.storage.photo_bucket_name
}

output "photo_bucket_arn" {
  description = "ARN of the S3 photo bucket."
  value       = module.storage.photo_bucket_arn
}

output "vector_bucket_name" {
  description = "S3 Vectors bucket name."
  value       = module.vectors.vector_bucket_name
}

output "vector_index_arn" {
  description = "ARN of the S3 Vectors index."
  value       = module.vectors.vector_index_arn
}

output "search_api_url" {
  description = "Base URL for the HTTP search API."
  value       = module.search.api_url
}

output "frontend_bucket" {
  description = "S3 bucket storing the built frontend assets."
  value       = try(module.frontend[0].bucket_name, "")
}

output "frontend_distribution_id" {
  description = "CloudFront distribution ID serving the frontend."
  value       = try(module.frontend[0].distribution_id, "")
}

output "frontend_url" {
  description = "Public URL of the frontend distribution."
  value       = try(module.frontend[0].frontend_url, "")
}
