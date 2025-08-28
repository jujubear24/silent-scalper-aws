import json
import os
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

# Initialize clients and get environment variables
s3_client = boto3.client("s3")
INCOMING_BUCKET_NAME = os.environ.get("INCOMING_BUCKET_NAME", "")


def lambda_handler(event: Dict[str, Any], context: object) -> Dict[str, Any]:
    """Generates a presigned URL for uploading a file to S3.

    This function is triggered by an API Gateway request. It expects a JSON
    body containing a 'fileName' key. It generates a temporary, secure URL
    that the client can use to upload the specified file directly to S3.

    Args:
      event: The event dictionary from API Gateway, containing the request body.
      context: The AWS Lambda runtime information object.

    Returns:
      An API Gateway response dictionary with the presigned URL or an error.
    """
    print(f"Received event: {json.dumps(event, indent=2)}")

    try:
        # The request body is a string, so we need to parse it as JSON.
        body = json.loads(event.get("body", "{}"))
        file_name = body.get("fileName")

        if not file_name:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps(
                    {"error": "fileName is required in the request body."}
                ),
            }

        # Generate the presigned URL for a PUT request.
        # This URL will be valid for 300 seconds (5 minutes).
        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": INCOMING_BUCKET_NAME, "Key": file_name},
            ExpiresIn=300,
        )

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST",
            },
            "body": json.dumps({"uploadUrl": presigned_url, "fileName": file_name}),
        }

    except ClientError as e:
        print(f"Boto3 client error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Could not generate upload URL."}),
        }
    except Exception as e:
        print(f"An unexpected error occurred: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "An internal server error occurred."}),
        }
