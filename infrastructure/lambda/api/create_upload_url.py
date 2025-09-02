import json
import os
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

s3_client = boto3.client("s3")
INCOMING_BUCKET_NAME = os.environ.get("INCOMING_BUCKET_NAME", "")


def lambda_handler(event: Dict[str, Any], context: object) -> Dict[str, Any]:
    """Handles API Gateway requests to generate an S3 presigned URL for uploads.

    The frontend sends a POST request with a JSON body containing the `fileName`.
    This function generates a temporary, secure URL that the frontend can use
    to upload the file directly to the incoming S3 bucket.

    Args:
      event: The event dictionary from API Gateway, expected to have a JSON body.
      context: The runtime information object.

    Returns:
      An API Gateway response dictionary with the presigned URL.
    """
    print(f"Received event: {json.dumps(event)}")

    # FIX: Add robust input validation
    try:
        body = json.loads(event.get("body") or "{}")
        file_name = body.get("fileName")

        if not file_name:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Missing fileName in request body"}),
            }

    except (json.JSONDecodeError, TypeError):
        return {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Invalid JSON in request body"}),
        }

    try:
        # Generate the presigned URL for a PUT request
        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": INCOMING_BUCKET_NAME, "Key": file_name},
            ExpiresIn=300,  # URL is valid for 5 minutes
        )

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST",
            },
            "body": json.dumps({"uploadUrl": presigned_url, "key": file_name}),
        }

    except ClientError as e:
        print(f"Error generating presigned URL: {e}")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Could not generate upload URL"}),
        }
