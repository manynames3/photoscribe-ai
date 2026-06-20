output "lambda_name" {
  value = aws_lambda_function.this.function_name
}

output "lambda_arn" {
  value = aws_lambda_function.this.arn
}

output "queue_name" {
  value = aws_sqs_queue.ingest.name
}

output "queue_arn" {
  value = aws_sqs_queue.ingest.arn
}

output "dlq_name" {
  value = aws_sqs_queue.ingest_dlq.name
}

output "dlq_arn" {
  value = aws_sqs_queue.ingest_dlq.arn
}

output "event_source_enabled" {
  value = aws_lambda_event_source_mapping.ingest_queue.enabled
}

output "queue_receive_wait_time_seconds" {
  value = aws_sqs_queue.ingest.receive_wait_time_seconds
}

output "dlq_receive_wait_time_seconds" {
  value = aws_sqs_queue.ingest_dlq.receive_wait_time_seconds
}
