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

resource "aws_cloudwatch_dashboard" "operations" {
  count = var.enable_operational_dashboard ? 1 : 0

  dashboard_body = jsonencode({
    widgets = [
      {
        height = 6
        type   = "metric"
        width  = 12
        x      = 0
        y      = 0
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", var.ingest_lambda_name, { label = "Ingest invocations", stat = "Sum" }],
            [".", ".", ".", var.search_lambda_name, { label = "Search invocations", stat = "Sum" }],
            [".", "Errors", ".", var.ingest_lambda_name, { label = "Ingest errors", stat = "Sum", yAxis = "right" }],
            [".", ".", ".", var.search_lambda_name, { label = "Search errors", stat = "Sum", yAxis = "right" }],
          ]
          period = 300
          region = var.region
          title  = "Lambda traffic and errors"
          view   = "timeSeries"
        }
      },
      {
        height = 6
        type   = "metric"
        width  = 12
        x      = 12
        y      = 0
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", var.search_api_id, "Stage", var.search_api_stage_name, { label = "Requests", stat = "Sum" }],
            [".", "4xx", ".", ".", ".", ".", { label = "4xx", stat = "Sum", yAxis = "right" }],
            [".", "5xx", ".", ".", ".", ".", { label = "5xx", stat = "Sum", yAxis = "right" }],
            [".", "Latency", ".", ".", ".", ".", { label = "Latency p95", stat = "p95" }],
          ]
          period = 300
          region = var.region
          title  = "HTTP API health"
          view   = "timeSeries"
        }
      },
      {
        height = 6
        type   = "metric"
        width  = 12
        x      = 0
        y      = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", var.ingest_queue_name, { label = "Oldest ingest message age", stat = "Maximum" }],
            [".", "ApproximateNumberOfMessagesVisible", ".", var.ingest_queue_name, { label = "Queued ingest messages", stat = "Maximum", yAxis = "right" }],
            [".", ".", ".", var.ingest_dlq_name, { label = "DLQ messages", stat = "Maximum", yAxis = "right" }],
            [".", "NumberOfEmptyReceives", ".", var.ingest_queue_name, { label = "Empty receives", stat = "Sum", yAxis = "right" }],
          ]
          period = 300
          region = var.region
          title  = "Ingest queue and DLQ"
          view   = "timeSeries"
        }
      },
      {
        height = 6
        type   = "log"
        width  = 12
        x      = 12
        y      = 6
        properties = {
          query  = "SOURCE '${var.ingest_log_group_name}' | fields @timestamp, @message | filter @message like /ingest failed|thumbnail generation failed/ | sort @timestamp desc | limit 20"
          region = var.region
          title  = "Recent ingest failures"
          view   = "table"
        }
      },
      {
        height = 6
        type   = "metric"
        width  = 12
        x      = 0
        y      = 12
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", var.ingest_lambda_name, { label = "Ingest p95", stat = "p95" }],
            [".", ".", ".", var.search_lambda_name, { label = "Search p95", stat = "p95" }],
            [".", "Throttles", ".", var.ingest_lambda_name, { label = "Ingest throttles", stat = "Sum", yAxis = "right" }],
            [".", ".", ".", var.search_lambda_name, { label = "Search throttles", stat = "Sum", yAxis = "right" }],
          ]
          period = 300
          region = var.region
          title  = "Lambda latency and throttles"
          view   = "timeSeries"
        }
      },
      {
        height = 6
        type   = "log"
        width  = 12
        x      = 12
        y      = 12
        properties = {
          query  = "SOURCE '${var.search_log_group_name}' | fields @timestamp, @message | filter @message like /ERROR|error|failed/ | sort @timestamp desc | limit 20"
          region = var.region
          title  = "Recent search/API failures"
          view   = "table"
        }
      },
    ]
  })
  dashboard_name = "photoscribe-${var.tags["Environment"]}-operations"
}
