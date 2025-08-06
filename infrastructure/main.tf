# ==============================================================================
# TERRAFORM AND PROVIDER CONFIGURATION
# ==============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # The random provider is used to generate a unique suffix for our S3 buckets.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# Configure the AWS Provider.
provider "aws" {
  region = "us-east-2"
}

# ==============================================================================
# RESOURCE DEFINITIONS
# ==============================================================================

# This resource generates a random, two-word pet name (e.g., "nice-panda")
# to ensure our S3 bucket names are globally unique.
resource "random_pet" "unique_suffix" {
  length = 2
}

# ------------------------------------------------------------------------------
# Step 1: Data Ingestion (S3 Buckets)
# ------------------------------------------------------------------------------

# This is the S3 bucket where new files will be uploaded.
# It will act as the entry point for our data pipeline.
resource "aws_s3_bucket" "incoming_data" {
  # We combine a descriptive prefix with the random pet name.
  bucket = "incoming-data-${random_pet.unique_suffix.id}"

  # NOTE: The 'force_destroy' argument is useful for development, as it allows
  # you to destroy the bucket with 'terraform destroy' even if it contains objects.
  # Do NOT use this in a production environment where you want to protect data.
  force_destroy = true

  tags = {
    Name        = "Silent Scalper - Incoming Data"
    Project     = "Silent Scalper"
    Environment = "Development"
  }
}

# This is the S3 bucket where files that fail processing will be moved.
# This isolates bad data for manual review without halting the pipeline.
resource "aws_s3_bucket" "quarantine" {
  bucket = "quarantine-${random_pet.unique_suffix.id}"

  # Same note as above regarding force_destroy.
  force_destroy = true

  tags = {
    Name        = "Silent Scalper - Quarantine"
    Project     = "Silent Scalper"
    Environment = "Development"
  }
}

# ------------------------------------------------------------------------------
# Step 3: Data Storage (DynamoDB)
# ------------------------------------------------------------------------------

# This DynamoDB table will store the successfully processed data.
resource "aws_dynamodb_table" "processed_data" {
  name = "silent-scalper-processed-data"

  # PAY_PER_REQUEST is a cost-effective choice for serverless applications
  # with unpredictable workloads, as you only pay for the reads and writes you use.
  billing_mode = "PAY_PER_REQUEST"

  # This is the primary key for the table. Every item must have this attribute.
  hash_key = "recordId"

  # Here we define the schema for the attributes used as keys.
  # 'S' stands for String. Other types are 'N' (Number) and 'B' (Binary).
  attribute {
    name = "recordId"
    type = "S"
  }

  tags = {
    Name        = "Silent Scalper - Processed Data"
    Project     = "Silent Scalper"
    Environment = "Development"
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

# Outputs display values in the terminal after Terraform applies the configuration.
# This is useful for seeing the names of the resources that were created.

output "incoming_data_bucket_name" {
  description = "The name of the S3 bucket for incoming data."
  value       = aws_s3_bucket.incoming_data.bucket
}

output "quarantine_bucket_name" {
  description = "The name of the S3 bucket for quarantined files."
  value       = aws_s3_bucket.quarantine.bucket
}

output "dynamodb_table_name" {
  description = "The name of the DynamoDB table for processed data."
  value       = aws_dynamodb_table.processed_data.name
}
