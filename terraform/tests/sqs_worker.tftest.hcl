mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }

  mock_data "aws_partition" {
    defaults = {
      partition = "aws"
    }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

mock_provider "aws" {
  alias = "billing"
}

mock_provider "awscc" {}
mock_provider "archive" {}

variables {
  alert_email                 = "ops@example.com"
  enable_aws_frontend_hosting = false
  env                         = "dev"
  frontend_origin             = "http://localhost:5173"
}

run "dev_worker_is_disabled_by_default" {
  command = plan

  assert {
    condition     = module.ingest.event_source_enabled == false
    error_message = "The dev SQS worker must not poll unless explicitly enabled."
  }

  assert {
    condition = (
      module.ingest.queue_receive_wait_time_seconds == 20 &&
      module.ingest.dlq_receive_wait_time_seconds == 20
    )
    error_message = "The source queue and DLQ must use 20-second long polling."
  }
}

run "dev_worker_can_be_enabled_explicitly" {
  command = plan

  variables {
    enable_sqs_worker = true
  }

  assert {
    condition     = module.ingest.event_source_enabled == true
    error_message = "The explicit development flag must enable the SQS worker."
  }
}

run "production_worker_remains_enabled" {
  command = plan

  variables {
    env = "prod"
  }

  assert {
    condition     = module.ingest.event_source_enabled == true
    error_message = "The production SQS worker must remain enabled by default."
  }
}
