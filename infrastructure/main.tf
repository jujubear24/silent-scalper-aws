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

# ==============================================================================
# IAM ROLE FOR LAMBDA
# ==============================================================================

# This data source defines the "trust policy" for our IAM role.
# It specifies that the AWS Lambda service is allowed to "assume" this role.
# In simple terms, it lets a Lambda function use the permissions we will attach.
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# This is the IAM Role that our Lambda function will use.
resource "aws_iam_role" "lambda_execution_role" {
  name               = "silent-scalper-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

# This data source defines the permissions policy for our Lambda function.
# It grants the specific permissions needed to interact with other AWS services.
data "aws_iam_policy_document" "lambda_permissions" {
  # Allow creating log groups and log streams in CloudWatch for logging.
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }

  # Allow writing items to our DynamoDB table.
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.processed_data.arn]
  }

  # Allow reading files from the incoming S3 bucket.
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject"
    ]
    resources = ["${aws_s3_bucket.incoming_data.arn}/*"] # Note the /* for objects
  }

  # Allow moving failed files to the quarantine bucket.
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    # Permissions are needed for both the source and destination.
    resources = [
      "${aws_s3_bucket.incoming_data.arn}/*",
      "${aws_s3_bucket.quarantine.arn}/*"
    ]
  }
}

# This resource attaches the permissions policy to our IAM role.
resource "aws_iam_role_policy" "lambda_policy_attachment" {
  name   = "silent-scalper-lambda-permissions"
  role   = aws_iam_role.lambda_execution_role.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}


# ==============================================================================
# LAMBDA FUNCTION
# ==============================================================================

# This data source creates a zip archive of our Python code.
# Terraform will create this zip file automatically before deploying the Lambda.
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

# This is the Lambda function resource itself.
resource "aws_lambda_function" "file_processor" {
  # The function name.
  function_name = "silent-scalper-file-processor"

  # The IAM role the function will use.
  role = aws_iam_role.lambda_execution_role.arn

  # Path to the deployment package (the zip file we created).
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  # The function's entry point. Format is "filename.handler_function_name".
  handler = "process_file.lambda_handler"
  runtime = "python3.12"
  timeout = 30 # seconds

  # Pass environment variables to the Lambda function.
  # This is how our Python code knows the names of our other resources.
  environment {
    variables = {
      PROCESSED_TABLE_NAME   = aws_dynamodb_table.processed_data.name
      QUARANTINE_BUCKET_NAME = aws_s3_bucket.quarantine.bucket
    }
  }

  # Ensure the role and policy are created before the function.
  depends_on = [
    aws_iam_role_policy.lambda_policy_attachment
  ]
}


# ==============================================================================
# S3 BUCKET NOTIFICATION (The Trigger)
# ==============================================================================

# This resource grants S3 permission to invoke our Lambda function.
resource "aws_lambda_permission" "allow_s3_invoke" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.file_processor.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.incoming_data.arn
}

# This resource configures the S3 bucket to send an event to our Lambda
# whenever a new object is created. This is the trigger for our pipeline.
resource "aws_s3_bucket_notification" "s3_trigger" {
  bucket = aws_s3_bucket.incoming_data.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.file_processor.arn
    events              = ["s3:ObjectCreated:*"]
  }

  # Ensure the Lambda permission is in place before setting up the notification.
  depends_on = [aws_lambda_permission.allow_s3_invoke]
}


# ==============================================================================
# PHASE 2: MONITORING & ALERTING
# ==============================================================================

# ------------------------------------------------------------------------------
# SNS TOPIC FOR ALERTS
# ------------------------------------------------------------------------------

# This resource creates an SNS topic that will be used to send alerts.
resource "aws_sns_topic" "error_alerts" {
  name = "silent-scalper-error-alerts"
}

# This resource creates a subscription to the SNS topic.
# IMPORTANT: You must replace "your-email@example.com" with your actual email.
# After you run 'terraform apply', AWS will send a confirmation email to this
# address. You MUST click the confirmation link in that email to activate
# the subscription.
resource "aws_sns_topic_subscription" "email_subscription" {
  topic_arn = aws_sns_topic.error_alerts.arn
  protocol  = "email"
  endpoint  = "julesbahanyi@gmail.com" 
}

# ------------------------------------------------------------------------------
# CLOUDWATCH ALARM
# ------------------------------------------------------------------------------

# This resource creates a CloudWatch alarm that monitors our Lambda function
# for errors.
resource "aws_cloudwatch_metric_alarm" "lambda_error_alarm" {
  alarm_name          = "silent-scalper-lambda-error-alarm"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "60" # in seconds
  statistic           = "Sum"
  threshold           = "1" # Trigger if there is 1 or more errors

  # This links the alarm to our specific Lambda function.
  dimensions = {
    FunctionName = aws_lambda_function.file_processor.function_name
  }

  alarm_description = "This alarm triggers if the Silent Scalper Lambda function fails."

  # This tells the alarm to send a message to our SNS topic when it triggers.
  alarm_actions = [aws_sns_topic.error_alerts.arn]
  ok_actions    = [aws_sns_topic.error_alerts.arn] # Also notify when the alarm state returns to OK
}

