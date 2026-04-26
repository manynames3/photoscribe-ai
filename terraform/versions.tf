terraform {
  required_version = ">= 1.9.0"

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.5.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80"
    }
    awscc = {
      source  = "hashicorp/awscc"
      version = ">= 1.62.0"
    }
  }
}
