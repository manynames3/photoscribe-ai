terraform {
  required_providers {
    archive = {
      source = "hashicorp/archive"
    }
    aws = {
      source = "hashicorp/aws"
    }
  }
}

locals {
  package_dir            = "${path.root}/.terraform-build/${var.lambda_name}"
  package_module_name    = basename(var.lambda_source_dir)
  package_module_dir     = "${local.package_dir}/${local.package_module_name}"
  package_zip            = "${path.root}/.terraform-build/${var.lambda_name}.zip"
  package_recipe         = "v4"
  source_files           = sort(fileset(var.lambda_source_dir, "*.py"))
  source_hash            = sha256(join("", [for file in concat(local.source_files, ["requirements.txt"]) : filesha256("${var.lambda_source_dir}/${file}")]))
  image_model_is_profile = length(regexall("^(global|us)\\.", var.image_model_id)) > 0
  image_base_model       = local.image_model_is_profile ? replace(var.image_model_id, "/^(global|us)\\./", "") : var.image_model_id
  image_model_arns = local.image_model_is_profile ? [
    "arn:${var.partition}:bedrock:${var.region}:${var.account_id}:inference-profile/${var.image_model_id}",
    "arn:${var.partition}:bedrock:*::foundation-model/${local.image_base_model}",
    ] : [
    "arn:${var.partition}:bedrock:${var.region}::foundation-model/${var.image_model_id}",
  ]
  embed_arn = "arn:${var.partition}:bedrock:${var.region}::foundation-model/${var.embed_model_id}"
}

resource "aws_sqs_queue" "ingest" {
  name                      = "${var.lambda_name}-queue"
  message_retention_seconds = 345600
  receive_wait_time_seconds = 20
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ingest_dlq.arn
    maxReceiveCount     = 3
  })
  tags                       = var.tags
  visibility_timeout_seconds = 180
}

resource "aws_sqs_queue" "ingest_dlq" {
  name                      = "${var.lambda_name}-dlq"
  message_retention_seconds = 1209600
  receive_wait_time_seconds = 20
  tags                      = var.tags
}

resource "terraform_data" "package" {
  triggers_replace = [local.source_hash, local.package_recipe]

  provisioner "local-exec" {
    command = <<-EOT
      rm -rf '${local.package_dir}' '${local.package_zip}'
      mkdir -p '${local.package_module_dir}'
      python3 -m pip install --quiet \
        --requirement '${var.lambda_source_dir}/requirements.txt' \
        --target '${local.package_dir}' \
        --platform manylinux2014_x86_64 \
        --implementation cp \
        --python-version 3.12 \
        --abi cp312 \
        --only-binary=:all:
      cp '${var.lambda_source_dir}'/*.py '${local.package_module_dir}/'
      touch '${local.package_module_dir}/__init__.py'
    EOT
  }
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = local.package_dir
  output_path = local.package_zip

  depends_on = [terraform_data.package]
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      identifiers = ["lambda.amazonaws.com"]
      type        = "Service"
    }
  }
}

data "aws_iam_policy_document" "logs" {
  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:${var.partition}:logs:${var.region}:${var.account_id}:log-group:/aws/lambda/${var.lambda_name}:*",
    ]
  }

  statement {
    actions   = ["bedrock:InvokeModel"]
    resources = concat(local.image_model_arns, [local.embed_arn])
  }

  statement {
    actions   = ["s3:GetObject"]
    resources = ["${var.photo_bucket_arn}/*"]
  }

  statement {
    actions   = ["s3:PutObject"]
    resources = ["${var.photo_bucket_arn}/thumbnails/*"]
  }

  statement {
    actions   = ["s3vectors:PutVectors"]
    resources = [var.vector_index_arn]
  }

  statement {
    actions   = ["dynamodb:UpdateItem"]
    resources = [var.asset_policy_table_arn]
  }

  statement {
    actions = [
      "sqs:ChangeMessageVisibility",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
      "sqs:ReceiveMessage",
    ]
    resources = [aws_sqs_queue.ingest.arn]
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.lambda_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy" "logs" {
  name   = "${var.lambda_name}-logs"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.logs.json
}

resource "aws_lambda_function" "this" {
  function_name    = var.lambda_name
  role             = aws_iam_role.lambda.arn
  handler          = "${local.package_module_name}.handler.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  memory_size      = 512
  timeout          = 60
  tags             = var.tags

  environment {
    variables = {
      ASSET_POLICY_TABLE_NAME  = var.asset_policy_table_name
      BEDROCK_EMBED_DIMENSIONS = "1024"
      BEDROCK_EMBED_MODEL_ID   = var.embed_model_id
      BEDROCK_IMAGE_MODEL_ID   = var.image_model_id
      DEFAULT_ALLOWED_GROUPS   = join(",", var.default_allowed_groups)
      DEFAULT_REVIEW_STATUS    = var.default_review_status
      DEFAULT_VISIBILITY       = var.default_visibility
      PHOTO_BUCKET_NAME        = var.event_bucket_name
      SQS_IDLE_BACKOFF_MODE    = "aws-lambda-managed"
      SQS_RECEIVE_WAIT_SECONDS = "20"
      VECTOR_BUCKET_NAME       = var.vector_bucket_name
      VECTOR_INDEX_NAME        = var.vector_index_name
    }
  }

  depends_on = [data.archive_file.lambda]
}

resource "aws_s3_bucket_notification" "eventbridge" {
  bucket = var.event_bucket_name

  eventbridge = true
}

resource "aws_cloudwatch_event_rule" "photo_created" {
  name = "${var.lambda_name}-photo-created"

  event_pattern = jsonencode({
    source        = ["aws.s3"]
    "detail-type" = ["Object Created"]
    detail = {
      bucket = {
        name = [var.event_bucket_name]
      }
      object = {
        key = [
          {
            "anything-but" = {
              prefix = "thumbnails/"
            }
          }
        ]
      }
    }
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "eventbridge" {
  policy    = data.aws_iam_policy_document.eventbridge_queue.json
  queue_url = aws_sqs_queue.ingest.id
}

data "aws_iam_policy_document" "eventbridge_queue" {
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.ingest.arn]

    condition {
      test     = "ArnEquals"
      values   = [aws_cloudwatch_event_rule.photo_created.arn]
      variable = "aws:SourceArn"
    }

    principals {
      identifiers = ["events.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_cloudwatch_event_target" "queue" {
  arn  = aws_sqs_queue.ingest.arn
  rule = aws_cloudwatch_event_rule.photo_created.name
}

resource "aws_lambda_event_source_mapping" "ingest_queue" {
  batch_size                         = 1
  enabled                            = var.event_source_enabled
  event_source_arn                   = aws_sqs_queue.ingest.arn
  function_name                      = aws_lambda_function.this.arn
  maximum_batching_window_in_seconds = 0

  scaling_config {
    maximum_concurrency = var.event_source_max_concurrency
  }
}
