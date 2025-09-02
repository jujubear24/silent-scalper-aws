import json
import os
import uuid
from typing import Any, Dict
from urllib.parse import unquote_plus

import boto3

# Get config from environment (still read at import time)
PROCESSED_TABLE_NAME = os.environ.get("PROCESSED_TABLE_NAME", "")
QUARANTINE_BUCKET_NAME = os.environ.get("QUARANTINE_BUCKET_NAME", "")
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-2")  # default for tests

# Lazily initialized clients
_s3_client = None
_dynamodb = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3", region_name=AWS_REGION)
    return _s3_client


def get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


def lambda_handler(event: Dict[str, Any], context: object) -> Dict[str, Any]:
    """Processes an incoming S3 file, records metadata, or quarantines on failure."""
    print(f"Received event: {json.dumps(event, indent=2)}")

    for record in event["Records"]:
        source_bucket = record["s3"]["bucket"]["name"]
        source_key = unquote_plus(record["s3"]["object"]["key"])

        print(f"Processing file: s3://{source_bucket}/{source_key}")

        try:
            # --- Simulate business logic ---
            print("Simulating successful file processing.")

            # --- Record in DynamoDB ---
            table = get_dynamodb().Table(PROCESSED_TABLE_NAME)
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
            print(f"ERROR processing file {source_key}: {str(e)}")

            quarantine_key = f"failed/{source_key}"
            copy_source = {"Bucket": source_bucket, "Key": source_key}

            s3 = get_s3_client()
            print(
                f"Moving failed file to: s3://{QUARANTINE_BUCKET_NAME}/{quarantine_key}"
            )
            s3.copy_object(
                CopySource=copy_source,
                Bucket=QUARANTINE_BUCKET_NAME,
                Key=quarantine_key,
            )
            print(f"Deleting original file: s3://{source_bucket}/{source_key}")
            s3.delete_object(Bucket=source_bucket, Key=source_key)

            raise

    return {"statusCode": 200, "body": json.dumps("Processing complete!")}
