terraform {
  backend "s3" {
    key     = "photoscribe/dev/terraform.tfstate"
    encrypt = true
  }
}

