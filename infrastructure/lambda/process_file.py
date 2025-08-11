import json
import os
import uuid
from typing import Any, Dict
from urllib.parse import unquote_plus

import boto3

# Initialize the AWS clients for S3 and DynamoDB outside the handler.
# This is a best practice for performance, as it allows Lambda to reuse
# the connections across multiple invocations.
s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

# Get the DynamoDB table name and quarantine bucket name from environment variables
# which are set in the Terraform configuration.
PROCESSED_TABLE_NAME = os.environ.get("PROCESSED_TABLE_NAME", "")
QUARANTINE_BUCKET_NAME = os.environ.get("QUARANTINE_BUCKET_NAME", "")


def lambda_handler(event: Dict[str, Any], context: object) -> Dict[str, Any]:
    """Processes an incoming S3 file, records metadata, or quarantines on failure.

    This function is triggered by an S3 `ObjectCreated` event. It reads the
    event metadata, simulates processing the file, and writes a record to a
    DynamoDB table. If any part of the process fails, it moves the source
    file to a separate quarantine S3 bucket for manual inspection.

    Args:
      event: The event dictionary passed by AWS Lambda, containing S3 record
        data.
      context: The runtime information object provided by AWS Lambda. This is not
        used in the function but is a required parameter.

    Returns:
      A dictionary containing a statusCode and a JSON body indicating
      successful completion.

    Raises:
      Exception: Re-raises any exception caught during processing to
                 mark the Lambda invocation as a failure in CloudWatch.
    """
    print(f"Received event: {json.dumps(event, indent=2)}")

    # The event contains a list of records; we process each one.
    for record in event["Records"]:
        source_bucket = record["s3"]["bucket"]["name"]
        # The object key is URL-encoded, so we decode it to handle spaces, etc.
        source_key = unquote_plus(record["s3"]["object"]["key"])

        print(f"Processing file: s3://{source_bucket}/{source_key}")

        try:
            # --- Business Logic: Process the file ---
            print("Simulating successful file processing.")

            # --- Record successful processing in DynamoDB ---
            table = dynamodb.Table(PROCESSED_TABLE_NAME)
            record_id = str(uuid.uuid4())

            table.put_item(
                Item={
                    "recordId": record_id,
                    "fileName": source_key,
                    "sourceBucket": source_bucket,
                    "fileSize": record["s3"]["object"]["size"],
                }
            )
            print(f"Successfully recorded item {record_id} in DynamoDB.")

        except Exception as e:
            # --- Error Handling: Quarantine the file ---
            print(f"ERROR processing file {source_key}: {str(e)}")

            quarantine_key = f"failed/{source_key}"
            copy_source = {"Bucket": source_bucket, "Key": source_key}

            # 1. Copy the problematic file to the quarantine bucket.
            print(
                f"Moving failed file to: s3://{QUARANTINE_BUCKET_NAME}/{quarantine_key}"
            )
            s3_client.copy_object(
                CopySource=copy_source,
                Bucket=QUARANTINE_BUCKET_NAME,
                Key=quarantine_key,
            )

            # 2. Delete the original file to prevent re-processing.
            print(f"Deleting original file: s3://{source_bucket}/{source_key}")
            s3_client.delete_object(Bucket=source_bucket, Key=source_key)

            # Re-raise the exception to mark the Lambda invocation as failed.
            raise

    return {"statusCode": 200, "body": json.dumps("Processing complete!")}
