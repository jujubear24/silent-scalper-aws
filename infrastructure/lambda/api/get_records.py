import json
import os
from decimal import Decimal
from typing import Any, Dict, List

import boto3

# This is a best practice for performance.
dynamodb = boto3.resource("dynamodb")
PROCESSED_TABLE_NAME = os.environ.get("PROCESSED_TABLE_NAME", "")


# This class tells the json.dumps function how to handle Decimal objects,
# which are returned by DynamoDB for numeric values.
class DecimalEncoder(json.JSONEncoder):
    """A custom JSON encoder to handle DynamoDB's Decimal type."""

    def default(self, o: Any) -> Any:
        """Converts Decimal objects to integers."""
        if isinstance(o, Decimal):
            # You can also convert to float(o) if you expect decimal places.
            return int(o)
        return super(DecimalEncoder, self).default(o)


def lambda_handler(event: Dict[str, Any], context: object) -> Dict[str, Any]:
    """Handles API Gateway requests to fetch records from DynamoDB.

    This function scans the DynamoDB table for all processed file records
    and returns them.

    Args:
      event: The event dictionary passed by API Gateway.
      context: The runtime information object provided by AWS Lambda.

    Returns:
      A dictionary formatted for an API Gateway response, containing the
      statusCode, headers, and a JSON body with the list of records.
    """
    print(f"Received event: {json.dumps(event, indent=2)}")

    try:
        table = dynamodb.Table(PROCESSED_TABLE_NAME)

        # The .scan() operation reads every item in a table.
        # For large tables, this can be slow and expensive.
        response = table.scan()
        items = response.get("Items", [])

        while "LastEvaluatedKey" in response:
            print(f"Paginating... found {len(items)} items so far.")
            response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
            items.extend(response.get("Items", []))

        print(f"Found a total of {len(items)} items in DynamoDB.")

        return {
            "statusCode": 200,
            "headers": {
                # Required for CORS to allow our frontend to call the API
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,GET",
            },
            "body": json.dumps(items, cls=DecimalEncoder),
        }

    except Exception as e:
        print(f"Error scanning DynamoDB table: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "Could not retrieve records"}),
        }
