output "bucket_name" {
  description = "Frontend asset bucket name."
  value       = aws_s3_bucket.site.id
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "distribution_id" {
  description = "CloudFront distribution identifier."
  value       = aws_cloudfront_distribution.site.id
}

output "frontend_url" {
  description = "Public frontend URL."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}
