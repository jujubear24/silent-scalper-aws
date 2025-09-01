"""
This Lambda function generates a presigned URL for downloading an object from S3.
"""

import json
import os
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

# Best practice for performance: initialize clients outside the handler
s3_client = boto3.client("s3")
INCOMING_BUCKET_NAME = os.environ.get("INCOMING_BUCKET_NAME", "")


def lambda_handler(event: Dict[str, Any], context: object) -> Dict[str, Any]:
    """Handles API Gateway requests to generate a presigned URL for downloads.

    Args:
      event: The event dictionary from API Gateway, containing query string
             parameters.
      context: The runtime information object from AWS Lambda.

    Returns:
      A dictionary formatted for API Gateway, containing a secure, temporary
      URL for downloading the requested file.
    """
    print(f"Received event: {json.dumps(event, indent=2)}")

    try:
        # Extract the file name from the query string parameters
        query_params = event.get("queryStringParameters", {})
        file_name = query_params.get("fileName")

        if not file_name:
            raise ValueError("Missing 'fileName' query string parameter.")

        print(f"Generating download URL for file: {file_name}")

        # Generate the presigned URL with a 5-minute expiration
        presigned_url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": INCOMING_BUCKET_NAME, "Key": file_name},
            ExpiresIn=300,  # URL is valid for 5 minutes
        )

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "OPTIONS,GET",
            },
            "body": json.dumps({"downloadUrl": presigned_url}),
        }

    except ClientError as e:
        print(f"Boto3 client error generating URL: {str(e)}")
        # Check if the file doesn't exist
        if e.response["Error"]["Code"] == "NoSuchKey":
            return {
                "statusCode": 404,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "File not found."}),
            }
        # Handle other potential AWS errors
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Could not generate download URL."}),
        }
    except Exception as e:
        print(f"An unexpected error occurred: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "An internal error occurred."}),
        }
