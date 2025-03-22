#!/bin/bash
# Run the AWS Bedrock test script with credentials

# Check if credentials are provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./run-test.sh <aws_access_key_id> <aws_secret_access_key> [region]"
  echo "Example: ./run-test.sh AKIAIOSFODNN7EXAMPLE wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY us-east-1"
  exit 1
fi

# Set environment variables
export AWS_ACCESS_KEY_ID=$1
export AWS_SECRET_ACCESS_KEY=$2
export AWS_REGION=${3:-us-east-1}  # Default to us-east-1 if not provided

echo "Running test with AWS credentials..."
echo "Region: $AWS_REGION"
echo ""

# Run the test script
node test-bedrock.js $4  # Optional diff file path as 4th argument

# Clean up (don't leave credentials in env vars)
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_REGION 