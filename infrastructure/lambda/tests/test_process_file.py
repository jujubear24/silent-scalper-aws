import os
import json
import unittest
from unittest.mock import patch, MagicMock
import boto3
from moto import mock_aws
import sys

# Add parent directory so we can import process_file
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import process_file
from process_file import lambda_handler


@mock_aws
class TestFileProcessorLambda(unittest.TestCase):
    """Unit tests for the file processing Lambda function."""

    def setUp(self):
        """Set up mock AWS resources before each test."""
        self.region = "us-east-2"

        # Create mock S3 buckets
        self.s3_client = boto3.client("s3", region_name=self.region)
        self.incoming_bucket = "test-incoming-bucket"
        self.quarantine_bucket = "test-quarantine-bucket"
        self.s3_client.create_bucket(
            Bucket=self.incoming_bucket,
            CreateBucketConfiguration={"LocationConstraint": self.region},
        )
        self.s3_client.create_bucket(
            Bucket=self.quarantine_bucket,
            CreateBucketConfiguration={"LocationConstraint": self.region},
        )

        # Create mock DynamoDB table
        self.dynamodb_client = boto3.client("dynamodb", region_name=self.region)
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

        with patch("process_file.PROCESSED_TABLE_NAME", self.processed_table), patch(
            "process_file.QUARANTINE_BUCKET_NAME", self.quarantine_bucket
        ):
            response = lambda_handler(mock_event, None)

        self.assertEqual(response["statusCode"], 200)

        # Check DynamoDB
        dynamodb_table = boto3.resource("dynamodb", region_name=self.region).Table(
            self.processed_table
        )
        items = dynamodb_table.scan()["Items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["fileName"], file_key)

        # Check quarantine bucket is empty
        quarantine_objects = self.s3_client.list_objects_v2(
            Bucket=self.quarantine_bucket
        )
        self.assertNotIn("Contents", quarantine_objects)

    def test_failed_processing(self):
        """Test the failure path where processing fails and the file is quarantined."""
        file_key = "bad-file.txt"
        file_content = "this will fail"

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

        # Patch DynamoDB accessor instead of the old global
        mock_table = MagicMock()
        mock_table.put_item.side_effect = Exception("Simulated DynamoDB Error")

        with patch(
            "process_file.get_dynamodb",
            return_value=MagicMock(Table=lambda _: mock_table),
        ), patch("process_file.PROCESSED_TABLE_NAME", self.processed_table), patch(
            "process_file.QUARANTINE_BUCKET_NAME", self.quarantine_bucket
        ):

            with self.assertRaises(Exception):
                lambda_handler(mock_event, None)

        # Verify file went to quarantine
        quarantine_objects = self.s3_client.list_objects_v2(
            Bucket=self.quarantine_bucket
        )
        self.assertEqual(len(quarantine_objects.get("Contents", [])), 1)
        self.assertEqual(quarantine_objects["Contents"][0]["Key"], f"failed/{file_key}")

        # Verify file removed from incoming
        incoming_objects = self.s3_client.list_objects_v2(Bucket=self.incoming_bucket)
        self.assertNotIn("Contents", incoming_objects)


if __name__ == "__main__":
    unittest.main()
