terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.billing]
    }
  }
}

resource "aws_cloudwatch_log_group" "ingest" {
  name              = var.ingest_log_group_name
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "search" {
  name              = var.search_log_group_name
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_sns_topic" "billing" {
  provider = aws.billing
  name     = "photoscribe-${var.tags["Environment"]}-billing-alerts"
  tags     = var.tags
}

resource "aws_sns_topic_subscription" "billing_email" {
  provider  = aws.billing
  endpoint  = var.alert_email
  protocol  = "email"
  topic_arn = aws_sns_topic.billing.arn
}

resource "aws_cloudwatch_metric_alarm" "billing" {
  provider            = aws.billing
  alarm_name          = "photoscribe-${var.tags["Environment"]}-monthly-billing"
  alarm_description   = "Alerts when estimated monthly AWS charges exceed the Phase 1 development budget."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 21600
  statistic           = "Maximum"
  threshold           = var.billing_alarm_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.billing.arn]
  tags                = var.tags

  dimensions = {
    Currency = "USD"
  }
}

resource "aws_cloudwatch_metric_alarm" "ingest_lambda_errors" {
  count = var.enable_operational_alarms ? 1 : 0

  alarm_actions       = [aws_sns_topic.billing.arn]
  alarm_description   = "Alerts when the ingest Lambda records one or more errors."
  alarm_name          = "${var.ingest_lambda_name}-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  tags                = var.tags

  dimensions = {
    FunctionName = var.ingest_lambda_name
  }
}

resource "aws_cloudwatch_metric_alarm" "search_lambda_errors" {
  count = var.enable_operational_alarms ? 1 : 0

  alarm_actions       = [aws_sns_topic.billing.arn]
  alarm_description   = "Alerts when the search Lambda records one or more errors."
  alarm_name          = "${var.search_lambda_name}-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  tags                = var.tags

  dimensions = {
    FunctionName = var.search_lambda_name
  }
}

resource "aws_cloudwatch_metric_alarm" "search_api_5xx" {
  count = var.enable_operational_alarms ? 1 : 0

  alarm_actions       = [aws_sns_topic.billing.arn]
  alarm_description   = "Alerts when the HTTP API returns one or more 5xx responses."
  alarm_name          = "${var.search_lambda_name}-api-5xx"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  tags                = var.tags

  dimensions = {
    ApiId = var.search_api_id
    Stage = var.search_api_stage_name
  }
}

resource "aws_cloudwatch_metric_alarm" "ingest_queue_age" {
  count = var.enable_operational_alarms ? 1 : 0

  alarm_actions       = [aws_sns_topic.billing.arn]
  alarm_description   = "Alerts when ingest messages wait in SQS for more than 15 minutes."
  alarm_name          = "${var.ingest_queue_name}-oldest-message-age"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 900
  treat_missing_data  = "notBreaching"
  tags                = var.tags

  dimensions = {
    QueueName = var.ingest_queue_name
  }
}

resource "aws_cloudwatch_metric_alarm" "ingest_dlq_messages" {
  count = var.enable_operational_alarms ? 1 : 0

  alarm_actions       = [aws_sns_topic.billing.arn]
  alarm_description   = "Alerts when failed ingest events land in the dead-letter queue."
  alarm_name          = "${var.ingest_dlq_name}-messages-visible"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  tags                = var.tags

  dimensions = {
    QueueName = var.ingest_dlq_name
  }
}
