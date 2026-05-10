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
