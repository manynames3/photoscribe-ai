output "ingest_log_group_name" {
  value = aws_cloudwatch_log_group.ingest.name
}

output "search_log_group_name" {
  value = aws_cloudwatch_log_group.search.name
}

output "billing_topic_arn" {
  value = aws_sns_topic.billing.arn
}

