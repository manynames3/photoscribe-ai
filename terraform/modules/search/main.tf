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
  package_dir         = "${path.root}/.terraform-build/${var.lambda_name}"
  package_module_name = basename(var.lambda_source_dir)
  package_module_dir  = "${local.package_dir}/${local.package_module_name}"
  package_zip         = "${path.root}/.terraform-build/${var.lambda_name}.zip"
  package_recipe      = "v3"
  source_files        = sort(fileset(var.lambda_source_dir, "*.py"))
  source_hash         = sha256(join("", [for file in concat(local.source_files, ["requirements.txt"]) : filesha256("${var.lambda_source_dir}/${file}")]))
  embed_arn           = "arn:${var.partition}:bedrock:${var.region}::foundation-model/${var.embed_model_id}"
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
    resources = [local.embed_arn]
  }

  statement {
    actions   = ["s3vectors:QueryVectors", "s3vectors:GetVectors"]
    resources = [var.vector_index_arn]
  }

  statement {
    actions   = ["s3:GetObject"]
    resources = ["${var.photo_bucket_arn}/*"]
  }

  statement {
    actions   = ["s3:ListBucket"]
    resources = [var.photo_bucket_arn]

    condition {
      test     = "StringLike"
      values   = ["uploads/sha256/*"]
      variable = "s3:prefix"
    }
  }

  statement {
    actions   = ["s3:PutObject"]
    resources = ["${var.photo_bucket_arn}/uploads/*"]
  }

  statement {
    actions   = ["dynamodb:GetItem"]
    resources = [var.asset_policy_table_arn]
  }

  statement {
    actions   = ["dynamodb:PutItem"]
    resources = [var.audit_log_table_arn]
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
      BEDROCK_EMBED_DIMENSIONS = "1024"
      BEDROCK_EMBED_MODEL_ID   = var.embed_model_id
      ASSET_POLICY_TABLE_NAME  = var.asset_policy_table_name
      AUDIT_LOG_RETENTION_DAYS = tostring(var.audit_log_retention_days)
      AUDIT_LOG_TABLE_NAME     = var.audit_log_table_name
      MAX_UPLOAD_BYTES         = tostring(var.max_upload_bytes)
      MAX_VECTOR_DISTANCE      = tostring(var.max_vector_distance)
      MISSING_POLICY_DEFAULT   = var.missing_asset_policy_default
      PHOTO_BUCKET_NAME        = var.photo_bucket_name
      SIGNED_URL_TTL_SECONDS   = "900"
      UPLOAD_TOKEN_SHA256      = var.upload_token_sha256
      UPLOAD_URL_TTL_SECONDS   = "900"
      VECTOR_BUCKET_NAME       = var.vector_bucket_name
      VECTOR_INDEX_NAME        = var.vector_index_name
    }
  }

  depends_on = [data.archive_file.lambda]
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.lambda_name}-api"
  protocol_type = "HTTP"
  tags          = var.tags

  cors_configuration {
    allow_headers = ["*"]
    allow_methods = ["GET", "OPTIONS", "POST"]
    allow_origins = var.frontend_origins
    max_age       = 300
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_method     = "POST"
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.this.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  count = var.enable_api_auth ? 1 : 0

  api_id           = aws_apigatewayv2_api.http.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.lambda_name}-cognito"

  jwt_configuration {
    audience = var.cognito_audience
    issuer   = var.cognito_issuer
  }
}

resource "aws_apigatewayv2_route" "search" {
  api_id             = aws_apigatewayv2_api.http.id
  authorization_type = var.enable_api_auth ? "JWT" : "NONE"
  authorizer_id      = var.enable_api_auth ? aws_apigatewayv2_authorizer.cognito[0].id : null
  route_key          = "GET /search"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "upload_presign" {
  api_id             = aws_apigatewayv2_api.http.id
  authorization_type = var.enable_api_auth ? "JWT" : "NONE"
  authorizer_id      = var.enable_api_auth ? aws_apigatewayv2_authorizer.cognito[0].id : null
  route_key          = "POST /uploads/presign"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  auto_deploy = true
  name        = "$default"
  tags        = var.tags

  default_route_settings {
    throttling_burst_limit = 200
    throttling_rate_limit  = 100
  }
}

resource "aws_lambda_permission" "apigateway" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
  statement_id  = "AllowExecutionFromApiGateway"
}
