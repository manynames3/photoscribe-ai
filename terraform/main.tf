provider "aws" {
  region = var.region
}

provider "aws" {
  alias  = "billing"
  region = "us-east-1"
}

provider "awscc" {
  region = var.region
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

locals {
  project = "photoscribe"

  common_tags = {
    Environment = var.env
    ManagedBy   = "terraform"
    Project     = local.project
  }

  awscc_tags = [
    for key, value in local.common_tags : {
      key   = key
      value = value
    }
  ]

  name_prefix = "${local.project}-${var.env}"

  photo_bucket_name       = "${local.name_prefix}-${data.aws_caller_identity.current.account_id}-${var.region}-photos"
  vector_bucket_name      = "${local.name_prefix}-${data.aws_caller_identity.current.account_id}-${var.region}-vectors"
  vector_index_name       = "photos"
  frontend_bucket_name    = "${local.name_prefix}-${data.aws_caller_identity.current.account_id}-${var.region}-frontend"
  ingest_lambda_name      = "${local.name_prefix}-ingest"
  search_lambda_name      = "${local.name_prefix}-search"
  ingest_log_group_name   = "/aws/lambda/${local.ingest_lambda_name}"
  search_log_group_name   = "/aws/lambda/${local.search_lambda_name}"
  non_filterable_metadata = ["description", "alt_text", "seo_caption", "s3_key", "s3_uri", "subjects_csv", "colors_csv", "objects_csv"]
  frontend_origins        = distinct(compact(concat([var.frontend_origin], var.extra_frontend_origins, var.enable_aws_frontend_hosting ? [module.frontend[0].frontend_url] : [])))
  cognito_issuer          = var.enable_api_auth ? module.auth[0].issuer : ""
  cognito_audience        = var.enable_api_auth ? [module.auth[0].user_pool_client_id] : []
}

module "storage" {
  source = "./modules/storage"

  cors_allowed_origins = local.frontend_origins
  photo_bucket_name    = local.photo_bucket_name
  tags                 = local.common_tags
}

module "vectors" {
  source = "./modules/vectors"

  providers = {
    awscc = awscc
  }

  account_id                   = data.aws_caller_identity.current.account_id
  dimension                    = 1024
  distance_metric              = "cosine"
  index_name                   = local.vector_index_name
  non_filterable_metadata_keys = local.non_filterable_metadata
  partition                    = data.aws_partition.current.partition
  region                       = var.region
  tags                         = local.awscc_tags
  vector_bucket_name           = local.vector_bucket_name
}

module "observability" {
  source = "./modules/observability"

  providers = {
    aws         = aws
    aws.billing = aws.billing
  }

  alert_email             = var.alert_email
  billing_alarm_threshold = var.billing_alarm_threshold
  ingest_log_group_name   = local.ingest_log_group_name
  search_log_group_name   = local.search_log_group_name
  tags                    = local.common_tags
}

module "governance" {
  source = "./modules/governance"

  audit_retention_days = var.audit_log_retention_days
  name_prefix          = local.name_prefix
  tags                 = local.common_tags
}

module "auth" {
  source = "./modules/auth"
  count  = var.enable_api_auth ? 1 : 0

  name_prefix = local.name_prefix
  role_names  = var.library_role_names
  tags        = local.common_tags
}

module "frontend" {
  source = "./modules/frontend"
  count  = var.enable_aws_frontend_hosting ? 1 : 0

  bucket_name = local.frontend_bucket_name
  tags        = local.common_tags
}

module "ingest" {
  source = "./modules/ingest"

  account_id                   = data.aws_caller_identity.current.account_id
  asset_policy_table_arn       = module.governance.asset_policy_table_arn
  asset_policy_table_name      = module.governance.asset_policy_table_name
  claude_model_id              = var.claude_model_id
  default_allowed_groups       = var.default_asset_allowed_groups
  default_review_status        = var.default_asset_review_status
  default_visibility           = var.default_asset_visibility
  embed_model_id               = var.embed_model_id
  event_source_max_concurrency = var.ingest_event_source_max_concurrency
  event_bucket_name            = module.storage.photo_bucket_name
  lambda_name                  = local.ingest_lambda_name
  lambda_source_dir            = "${path.root}/../lambdas/ingest"
  partition                    = data.aws_partition.current.partition
  photo_bucket_arn             = module.storage.photo_bucket_arn
  region                       = var.region
  tags                         = local.common_tags
  vector_bucket_name           = module.vectors.vector_bucket_name
  vector_index_arn             = module.vectors.vector_index_arn
  vector_index_name            = local.vector_index_name
}

module "search" {
  source = "./modules/search"

  account_id                   = data.aws_caller_identity.current.account_id
  asset_policy_table_arn       = module.governance.asset_policy_table_arn
  asset_policy_table_name      = module.governance.asset_policy_table_name
  audit_log_retention_days     = var.audit_log_retention_days
  audit_log_table_arn          = module.governance.audit_log_table_arn
  audit_log_table_name         = module.governance.audit_log_table_name
  cognito_audience             = local.cognito_audience
  cognito_issuer               = local.cognito_issuer
  embed_model_id               = var.embed_model_id
  enable_api_auth              = var.enable_api_auth
  frontend_origins             = local.frontend_origins
  lambda_name                  = local.search_lambda_name
  lambda_source_dir            = "${path.root}/../lambdas/search"
  max_upload_bytes             = var.max_upload_bytes
  missing_asset_policy_default = var.missing_asset_policy_default
  partition                    = data.aws_partition.current.partition
  photo_bucket_arn             = module.storage.photo_bucket_arn
  photo_bucket_name            = module.storage.photo_bucket_name
  region                       = var.region
  tags                         = local.common_tags
  upload_token_sha256          = var.upload_token_sha256
  vector_bucket_name           = module.vectors.vector_bucket_name
  vector_index_arn             = module.vectors.vector_index_arn
  vector_index_name            = local.vector_index_name
}
