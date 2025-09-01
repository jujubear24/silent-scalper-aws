import os
import json
import unittest
from unittest.mock import patch
import boto3
from moto import mock_aws

# To make this test runnable, we need to add the parent directory to the path
# so that it can find and import the 'process_file' module.
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
# We import the module here, which reads the environment variables at import time.
# Our tests will patch the variables inside this already-imported module.
import process_file
from process_file import lambda_handler


# The @mock_aws decorator intercepts any boto3 calls and redirects them to the mock environment.
@mock_aws
class TestFileProcessorLambda(unittest.TestCase):
    """Unit tests for the file processing Lambda function."""

    def setUp(self):
        """Set up mock AWS resources before each test."""
        # Note: We no longer set os.environ here, as it's unreliable due to import-time evaluation.
        # We will use patching within each test instead.

        # Create mock S3 buckets
        self.s3_client = boto3.client("s3", region_name="us-east-2")
        self.incoming_bucket = "test-incoming-bucket"
        self.quarantine_bucket = "test-quarantine-bucket"
        self.s3_client.create_bucket(
            Bucket=self.incoming_bucket,
            CreateBucketConfiguration={"LocationConstraint": "us-east-2"},
        )
        self.s3_client.create_bucket(
            Bucket=self.quarantine_bucket,
            CreateBucketConfiguration={"LocationConstraint": "us-east-2"},
        )

        # Create mock DynamoDB table
        self.dynamodb_client = boto3.client("dynamodb", region_name="us-east-2")
        self.processed_table = "test-processed-table"
        self.dynamodb_client.create_table(
            TableName=self.processed_table,
            KeySchema=[{"AttributeName": "recordId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "recordId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )

    def test_successful_processing(self):
        """Test the success path where a file is processed correctly."""
        file_key = "test-file.txt"
        file_content = "hello world"

        # 1. Upload a dummy file to the mock incoming S3 bucket
        self.s3_client.put_object(
            Bucket=self.incoming_bucket, Key=file_key, Body=file_content
        )

        # 2. Create a mock S3 event that simulates the file upload
        mock_event = {
            "Records": [
                {
                    "s3": {
                        "bucket": {"name": self.incoming_bucket},
                        "object": {"key": file_key, "size": len(file_content)},
                    }
                }
            ]
        }

        # 3. Patch the module-level variables for the duration of this test
        #    This is necessary because the variables in process_file are set at import time.
        with patch("process_file.PROCESSED_TABLE_NAME", self.processed_table), patch(
            "process_file.QUARANTINE_BUCKET_NAME", self.quarantine_bucket
        ):
            response = lambda_handler(mock_event, None)

        # 4. Assert the results
        self.assertEqual(response["statusCode"], 200)

        # Verify that the item was added to the DynamoDB table
        dynamodb_table = boto3.resource("dynamodb", region_name="us-east-2").Table(
            self.processed_table
        )
        items = dynamodb_table.scan()["Items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["fileName"], file_key)

        # Verify the file was NOT moved to quarantine
        quarantine_objects = self.s3_client.list_objects_v2(
            Bucket=self.quarantine_bucket
        )
        self.assertNotIn("Contents", quarantine_objects)

    def test_failed_processing(self):
        """Test the failure path where processing fails and the file is quarantined."""
        file_key = "bad-file.txt"
        file_content = "this will fail"

        # Upload a dummy file
        self.s3_client.put_object(
            Bucket=self.incoming_bucket, Key=file_key, Body=file_content
        )

        mock_event = {
            "Records": [
                {
                    "s3": {
                        "bucket": {"name": self.incoming_bucket},
                        "object": {"key": file_key, "size": len(file_content)},
                    }
                }
            ]
        }

        # Patch the module-level variables and mock a failure in the DynamoDB call
        with patch("process_file.dynamodb.Table") as mock_table, patch(
            "process_file.PROCESSED_TABLE_NAME", self.processed_table
        ), patch("process_file.QUARANTINE_BUCKET_NAME", self.quarantine_bucket):

            # Configure the mock to raise an exception when put_item is called,
            # which correctly simulates a failure inside the try block.
            mock_table.return_value.put_item.side_effect = Exception(
                "Simulated DynamoDB Error"
            )

            # The handler should catch the exception and raise it again, so we expect an exception here.
            with self.assertRaises(Exception):
                lambda_handler(mock_event, None)

        # Verify the file was moved to the quarantine bucket
        quarantine_objects = self.s3_client.list_objects_v2(
            Bucket=self.quarantine_bucket
        )
        self.assertEqual(len(quarantine_objects.get("Contents", [])), 1)
        self.assertEqual(quarantine_objects["Contents"][0]["Key"], f"failed/{file_key}")

        # Verify the original file was deleted from the incoming bucket
        incoming_objects = self.s3_client.list_objects_v2(Bucket=self.incoming_bucket)
        self.assertNotIn("Contents", incoming_objects)


if __name__ == "__main__":
    unittest.main()

