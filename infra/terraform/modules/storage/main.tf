terraform {
  required_version = ">= 1.8.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "bucket_name" {
  type        = string
  description = "Object storage bucket name for Qelem"
}

resource "aws_s3_bucket" "qelem_media" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_public_access_block" "block_public_incoming" {
  bucket = aws_s3_bucket.qelem_media.id

  block_public_acls       = true
  block_public_policy     = false # Allows public reads restricted strictly to media/ prefix
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_cors_configuration" "media_cors" {
  bucket = aws_s3_bucket.qelem_media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET"]
    allowed_origins = ["https://app.qelem.et", "https://staging.qelem.et", "http://localhost:3000"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}
