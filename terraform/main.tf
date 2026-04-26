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
}

module "storage" {
  source = "./modules/storage"

  photo_bucket_name = local.photo_bucket_name
  tags              = local.common_tags
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

module "frontend" {
  source = "./modules/frontend"
  count  = var.enable_aws_frontend_hosting ? 1 : 0

  bucket_name = local.frontend_bucket_name
  tags        = local.common_tags
}

module "ingest" {
  source = "./modules/ingest"

  account_id         = data.aws_caller_identity.current.account_id
  claude_model_id    = var.claude_model_id
  embed_model_id     = var.embed_model_id
  event_bucket_name  = module.storage.photo_bucket_name
  lambda_name        = local.ingest_lambda_name
  lambda_source_dir  = "${path.root}/../lambdas/ingest"
  partition          = data.aws_partition.current.partition
  photo_bucket_arn   = module.storage.photo_bucket_arn
  region             = var.region
  tags               = local.common_tags
  vector_bucket_name = module.vectors.vector_bucket_name
  vector_index_arn   = module.vectors.vector_index_arn
  vector_index_name  = local.vector_index_name
}

module "search" {
  source = "./modules/search"

  account_id         = data.aws_caller_identity.current.account_id
  embed_model_id     = var.embed_model_id
  frontend_origins   = local.frontend_origins
  lambda_name        = local.search_lambda_name
  lambda_source_dir  = "${path.root}/../lambdas/search"
  partition          = data.aws_partition.current.partition
  photo_bucket_arn   = module.storage.photo_bucket_arn
  photo_bucket_name  = module.storage.photo_bucket_name
  region             = var.region
  tags               = local.common_tags
  vector_bucket_name = module.vectors.vector_bucket_name
  vector_index_arn   = module.vectors.vector_index_arn
  vector_index_name  = local.vector_index_name
}
