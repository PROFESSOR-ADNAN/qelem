terraform {
  required_version = ">= 1.8.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

module "production_storage" {
  source      = "../../modules/storage"
  bucket_name = "qelem-prod-media"
}

output "media_bucket_id" {
  value = module.production_storage
}
