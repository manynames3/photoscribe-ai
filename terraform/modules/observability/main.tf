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

