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
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.3"
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
resource "aws_s3_bucket" "incoming_data" {
  bucket = "incoming-data-${random_pet.unique_suffix.id}"
  tags = {
    Name        = "Silent Scalper - Incoming Data"
    Project     = "Silent Scalper"
    Environment = "Development"
  }
}

# S3 buckets need to be explicitly configured for public access blocking.
resource "aws_s3_bucket_public_access_block" "incoming_data_pac" {
  bucket = aws_s3_bucket.incoming_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# This resource handles the CORS configuration for the bucket, allowing
# direct browser uploads via presigned URLs.
resource "aws_s3_bucket_cors_configuration" "incoming_data_cors" {
  bucket = aws_s3_bucket.incoming_data.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST"]
    allowed_origins = ["*"] # For production, restrict this to your frontend URL
    expose_headers  = ["ETag"]
  }
}

# This is the S3 bucket where files that fail processing will be moved.
resource "aws_s3_bucket" "quarantine" {
  bucket = "quarantine-${random_pet.unique_suffix.id}"
  tags = {
    Name        = "Silent Scalper - Quarantine"
    Project     = "Silent Scalper"
    Environment = "Development"
  }
}

resource "aws_s3_bucket_public_access_block" "quarantine_pac" {
  bucket = aws_s3_bucket.quarantine.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ------------------------------------------------------------------------------
# Step 3: Data Storage (DynamoDB)
# ------------------------------------------------------------------------------

resource "aws_dynamodb_table" "processed_data" {
  name           = "silent-scalper-processed-data"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "recordId"

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
# LAMBDA FOR FILE PROCESSING
# ==============================================================================

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

resource "aws_iam_role" "lambda_execution_role" {
  name               = "silent-scalper-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.processed_data.arn]
  }
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.incoming_data.arn}/*"]
  }
  statement {
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.incoming_data.arn}/*", "${aws_s3_bucket.quarantine.arn}/*"]
  }
}

resource "aws_iam_role_policy" "lambda_policy_attachment" {
  name   = "silent-scalper-lambda-permissions"
  role   = aws_iam_role.lambda_execution_role.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "file_processor" {
  function_name    = "silent-scalper-file-processor"
  role             = aws_iam_role.lambda_execution_role.arn
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  handler          = "process_file.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  environment {
    variables = {
      PROCESSED_TABLE_NAME   = aws_dynamodb_table.processed_data.name
      QUARANTINE_BUCKET_NAME = aws_s3_bucket.quarantine.bucket
    }
  }
  depends_on = [aws_iam_role_policy.lambda_policy_attachment]
}

resource "aws_lambda_permission" "allow_s3_invoke" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.file_processor.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.incoming_data.arn
}

resource "aws_s3_bucket_notification" "s3_trigger" {
  bucket = aws_s3_bucket.incoming_data.id
  lambda_function {
    lambda_function_arn = aws_lambda_function.file_processor.arn
    events              = ["s3:ObjectCreated:*"]
  }
  depends_on = [aws_lambda_permission.allow_s3_invoke]
}

# ==============================================================================
# MONITORING & ALERTING
# ==============================================================================

resource "aws_sns_topic" "error_alerts" {
  name = "silent-scalper-error-alerts"
}

resource "aws_sns_topic_subscription" "email_subscription" {
  topic_arn = aws_sns_topic.error_alerts.arn
  protocol  = "email"
  endpoint  = "julesbahanyi@gmail.com"
}

resource "aws_cloudwatch_metric_alarm" "lambda_error_alarm" {
  alarm_name          = "silent-scalper-lambda-error-alarm"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "60"
  statistic           = "Sum"
  threshold           = "1"
  dimensions = {
    FunctionName = aws_lambda_function.file_processor.function_name
  }
  alarm_description = "This alarm triggers if the Silent Scalper Lambda function fails."
  alarm_actions     = [aws_sns_topic.error_alerts.arn]
  ok_actions        = [aws_sns_topic.error_alerts.arn]
}

# ==============================================================================
# API GATEWAY & LAMBDAS
# ==============================================================================

# ------------------------------------------------------------------------------
# API READER LAMBDA (GET /records)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "api_lambda_role" {
  name               = "silent-scalper-api-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}
data "aws_iam_policy_document" "api_lambda_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:Scan"]
    resources = [aws_dynamodb_table.processed_data.arn]
  }
}
resource "aws_iam_role_policy" "api_lambda_policy" {
  name   = "silent-scalper-api-lambda-permissions"
  role   = aws_iam_role.api_lambda_role.id
  policy = data.aws_iam_policy_document.api_lambda_permissions.json
}
data "archive_file" "api_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/api/get_records.py"
  output_path = "${path.module}/lambda_api.zip"
}
resource "aws_lambda_function" "api_records_reader" {
  function_name    = "silent-scalper-api-records-reader"
  role             = aws_iam_role.api_lambda_role.arn
  filename         = data.archive_file.api_lambda_zip.output_path
  source_code_hash = data.archive_file.api_lambda_zip.output_base64sha256
  handler          = "get_records.lambda_handler"
  runtime          = "python3.12"
  environment {
    variables = {
      PROCESSED_TABLE_NAME = aws_dynamodb_table.processed_data.name
    }
  }
  depends_on = [aws_iam_role_policy.api_lambda_policy]
}

# ------------------------------------------------------------------------------
# UPLOADER LAMBDA (POST /uploads)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "uploader_lambda_role" {
  name               = "silent-scalper-uploader-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}
data "aws_iam_policy_document" "uploader_lambda_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
  statement {
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.incoming_data.arn}/*"]
  }
}
resource "aws_iam_role_policy" "uploader_lambda_policy" {
  name   = "silent-scalper-uploader-lambda-permissions"
  role   = aws_iam_role.uploader_lambda_role.id
  policy = data.aws_iam_policy_document.uploader_lambda_permissions.json
}
data "archive_file" "uploader_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/api/create_upload_url.py"
  output_path = "${path.module}/lambda_uploader.zip"
}
resource "aws_lambda_function" "uploader_lambda" {
  function_name    = "silent-scalper-create-upload-url"
  role             = aws_iam_role.uploader_lambda_role.arn
  filename         = data.archive_file.uploader_lambda_zip.output_path
  source_code_hash = data.archive_file.uploader_lambda_zip.output_base64sha256
  handler          = "create_upload_url.lambda_handler"
  runtime          = "python3.12"
  environment {
    variables = {
      INCOMING_BUCKET_NAME = aws_s3_bucket.incoming_data.bucket
    }
  }
  depends_on = [aws_iam_role_policy.uploader_lambda_policy]
}

# ------------------------------------------------------------------------------
# DOWNLOADER LAMBDA (GET /downloads)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "downloader_lambda_role" {
  name               = "silent-scalper-downloader-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}
data "aws_iam_policy_document" "downloader_lambda_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.incoming_data.arn}/*"]
  }
}
resource "aws_iam_role_policy" "downloader_lambda_policy" {
  name   = "silent-scalper-downloader-lambda-permissions"
  role   = aws_iam_role.downloader_lambda_role.id
  policy = data.aws_iam_policy_document.downloader_lambda_permissions.json
}
data "archive_file" "downloader_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/api/create_download_url.py"
  output_path = "${path.module}/lambda_downloader.zip"
}
resource "aws_lambda_function" "downloader_lambda" {
  function_name    = "silent-scalper-create-download-url"
  role             = aws_iam_role.downloader_lambda_role.arn
  filename         = data.archive_file.downloader_lambda_zip.output_path
  source_code_hash = data.archive_file.downloader_lambda_zip.output_base64sha256
  handler          = "create_download_url.lambda_handler"
  runtime          = "python3.12"
  environment {
    variables = {
      INCOMING_BUCKET_NAME = aws_s3_bucket.incoming_data.bucket
    }
  }
  depends_on = [aws_iam_role_policy.downloader_lambda_policy]
}

# ------------------------------------------------------------------------------
# API GATEWAY (REST API)
# ------------------------------------------------------------------------------

resource "aws_api_gateway_rest_api" "default" {
  name        = "silent-scalper-api"
  description = "API for the Silent Scalper project"
}

# --- /records endpoint ---
resource "aws_api_gateway_resource" "records" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  parent_id   = aws_api_gateway_rest_api.default.root_resource_id
  path_part   = "records"
}
resource "aws_api_gateway_method" "get_records" {
  rest_api_id      = aws_api_gateway_rest_api.default.id
  resource_id      = aws_api_gateway_resource.records.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = true
}
resource "aws_api_gateway_integration" "lambda_get" {
  rest_api_id             = aws_api_gateway_rest_api.default.id
  resource_id             = aws_api_gateway_resource.records.id
  http_method             = aws_api_gateway_method.get_records.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api_records_reader.invoke_arn
}
resource "aws_api_gateway_method" "options_records" {
  rest_api_id   = aws_api_gateway_rest_api.default.id
  resource_id   = aws_api_gateway_resource.records.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}
resource "aws_api_gateway_integration" "options_records" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  resource_id = aws_api_gateway_resource.records.id
  http_method = aws_api_gateway_method.options_records.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}
resource "aws_api_gateway_method_response" "options_200_records" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  resource_id = aws_api_gateway_resource.records.id
  http_method = aws_api_gateway_method.options_records.http_method
  status_code = "200"
  response_models = {
    "application/json" = "Empty"
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}
resource "aws_api_gateway_integration_response" "options_records" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  resource_id = aws_api_gateway_resource.records.id
  http_method = aws_api_gateway_method.options_records.http_method
  status_code = aws_api_gateway_method_response.options_200_records.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  response_templates = {
    "application/json" = ""
  }
  depends_on = [aws_api_gateway_integration.options_records]
}

# --- /uploads endpoint ---
resource "aws_api_gateway_resource" "uploads" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  parent_id   = aws_api_gateway_rest_api.default.root_resource_id
  path_part   = "uploads"
}
resource "aws_api_gateway_method" "post_uploads" {
  rest_api_id      = aws_api_gateway_rest_api.default.id
  resource_id      = aws_api_gateway_resource.uploads.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}
resource "aws_api_gateway_integration" "lambda_post_uploads" {
  rest_api_id             = aws_api_gateway_rest_api.default.id
  resource_id             = aws_api_gateway_resource.uploads.id
  http_method             = aws_api_gateway_method.post_uploads.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.uploader_lambda.invoke_arn
}
resource "aws_api_gateway_method" "options_uploads" {
  rest_api_id   = aws_api_gateway_rest_api.default.id
  resource_id   = aws_api_gateway_resource.uploads.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}
resource "aws_api_gateway_integration" "options_uploads" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  resource_id = aws_api_gateway_resource.uploads.id
  http_method = aws_api_gateway_method.options_uploads.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}
resource "aws_api_gateway_method_response" "options_200_uploads" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  resource_id = aws_api_gateway_resource.uploads.id
  http_method = aws_api_gateway_method.options_uploads.http_method
  status_code = "200"
  response_models = {
    "application/json" = "Empty"
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}
resource "aws_api_gateway_integration_response" "options_uploads" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  resource_id = aws_api_gateway_resource.uploads.id
  http_method = aws_api_gateway_method.options_uploads.http_method
  status_code = aws_api_gateway_method_response.options_200_uploads.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  response_templates = {
    "application/json" = ""
  }
  depends_on = [aws_api_gateway_integration.options_uploads]
}


# --- /downloads endpoint ---
resource "aws_api_gateway_resource" "downloads" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  parent_id   = aws_api_gateway_rest_api.default.root_resource_id
  path_part   = "downloads"
}
resource "aws_api_gateway_method" "get_downloads" {
  rest_api_id      = aws_api_gateway_rest_api.default.id
  resource_id      = aws_api_gateway_resource.downloads.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = true
}
resource "aws_api_gateway_integration" "lambda_get_downloads" {
  rest_api_id             = aws_api_gateway_rest_api.default.id
  resource_id             = aws_api_gateway_resource.downloads.id
  http_method             = aws_api_gateway_method.get_downloads.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.downloader_lambda.invoke_arn
}
resource "aws_api_gateway_method" "options_downloads" {
  rest_api_id   = aws_api_gateway_rest_api.default.id
  resource_id   = aws_api_gateway_resource.downloads.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}
resource "aws_api_gateway_integration" "options_downloads" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  resource_id = aws_api_gateway_resource.downloads.id
  http_method = aws_api_gateway_method.options_downloads.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}
resource "aws_api_gateway_method_response" "options_200_downloads" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  resource_id = aws_api_gateway_resource.downloads.id
  http_method = aws_api_gateway_method.options_downloads.http_method
  status_code = "200"
  response_models = {
    "application/json" = "Empty"
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}
resource "aws_api_gateway_integration_response" "options_downloads" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  resource_id = aws_api_gateway_resource.downloads.id
  http_method = aws_api_gateway_method.options_downloads.http_method
  status_code = aws_api_gateway_method_response.options_200_downloads.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  response_templates = {
    "application/json" = ""
  }
  depends_on = [aws_api_gateway_integration.options_downloads]
}


# --- Deployment and Stage ---
resource "aws_api_gateway_deployment" "default" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.records.id,
      aws_api_gateway_method.get_records.id,
      aws_api_gateway_integration.lambda_get.id,
      aws_api_gateway_method.options_records.id,
      aws_api_gateway_integration.options_records.id,
      aws_api_gateway_resource.uploads.id,
      aws_api_gateway_method.post_uploads.id,
      aws_api_gateway_integration.lambda_post_uploads.id,
      aws_api_gateway_method.options_uploads.id,
      aws_api_gateway_integration.options_uploads.id,
      aws_api_gateway_resource.downloads.id,
      aws_api_gateway_method.get_downloads.id,
      aws_api_gateway_integration.lambda_get_downloads.id,
      aws_api_gateway_method.options_downloads.id,
      aws_api_gateway_integration.options_downloads.id,
    ]))
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "aws_api_gateway_stage" "default" {
  deployment_id = aws_api_gateway_deployment.default.id
  rest_api_id   = aws_api_gateway_rest_api.default.id
  stage_name    = "prod"
}

# ------------------------------------------------------------------------------
# API GATEWAY SECURITY
# ------------------------------------------------------------------------------
resource "aws_api_gateway_api_key" "default" {
  name = "silent-scalper-frontend-key"
}
resource "aws_api_gateway_usage_plan" "default" {
  name = "silent-scalper-usage-plan"
  api_stages {
    api_id = aws_api_gateway_rest_api.default.id
    stage  = aws_api_gateway_stage.default.stage_name
  }
  throttle_settings {
    burst_limit = 5
    rate_limit  = 10
  }
}
resource "aws_api_gateway_usage_plan_key" "default" {
  key_id        = aws_api_gateway_api_key.default.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.default.id
}

# ------------------------------------------------------------------------------
# LAMBDA PERMISSIONS
# ------------------------------------------------------------------------------
resource "aws_lambda_permission" "api_gateway_invoke_reader" {
  statement_id  = "AllowAPIGatewayInvokeReader"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_records_reader.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.default.execution_arn}/*/${aws_api_gateway_method.get_records.http_method}${aws_api_gateway_resource.records.path}"
}
resource "aws_lambda_permission" "api_gateway_invoke_uploader" {
  statement_id  = "AllowAPIGatewayInvokeUploader"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.uploader_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.default.execution_arn}/*/${aws_api_gateway_method.post_uploads.http_method}${aws_api_gateway_resource.uploads.path}"
}
resource "aws_lambda_permission" "api_gateway_invoke_downloader" {
  statement_id  = "AllowAPIGatewayInvokeDownloader"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.downloader_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.default.execution_arn}/*/${aws_api_gateway_method.get_downloads.http_method}${aws_api_gateway_resource.downloads.path}"
}

# ==============================================================================
# OUTPUTS
# ==============================================================================
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
output "api_endpoint_url" {
  description = "The base URL for the API Gateway endpoint."
  value       = aws_api_gateway_stage.default.invoke_url
}
