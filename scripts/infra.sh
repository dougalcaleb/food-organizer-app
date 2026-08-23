#!/usr/bin/env bash
#
# Creates or updates the hosting stack (bucket, CloudFront, deploy role).
# Run this by hand -- infrastructure changes are rare and CI has no permission
# to alter them, only to publish files.
set -euo pipefail

STACK="${STACK_NAME:-pantry-hosting}"
REGION="${AWS_REGION:-us-east-2}"

aws cloudformation deploy \
	--template-file infra/hosting.yaml \
	--stack-name "$STACK" \
	--region "$REGION" \
	--capabilities CAPABILITY_IAM \
	--no-fail-on-empty-changeset

echo
aws cloudformation describe-stacks \
	--stack-name "$STACK" --region "$REGION" \
	--query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
	--output table
