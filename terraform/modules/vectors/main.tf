terraform {
  required_providers {
    awscc = {
      source = "hashicorp/awscc"
    }
  }
}

resource "awscc_s3vectors_vector_bucket" "this" {
  vector_bucket_name = var.vector_bucket_name

  encryption_configuration = {
    sse_type = "AES256"
  }

  tags = var.tags
}

resource "awscc_s3vectors_index" "this" {
  data_type          = "float32"
  dimension          = var.dimension
  distance_metric    = var.distance_metric
  index_name         = var.index_name
  vector_bucket_name = var.vector_bucket_name

  metadata_configuration = {
    non_filterable_metadata_keys = var.non_filterable_metadata_keys
  }

  tags = var.tags

  depends_on = [awscc_s3vectors_vector_bucket.this]
}
