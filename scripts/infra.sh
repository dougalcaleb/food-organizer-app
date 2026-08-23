#!/usr/bin/env bash
#
# Creates or updates the hosting stack (bucket, CloudFront, deploy role, the
# cloud-backup bucket + function, and the account budget alarm). Run this by
# hand -- infrastructure changes are rare and CI has no permission to alter
# them, only to publish files.
set -euo pipefail

STACK="${STACK_NAME:-pantry-hosting}"
REGION="${AWS_REGION:-us-east-2}"
TOKEN_FILE=src/lib/backupToken.ts

# The backup endpoint's bearer token. It is not a secret -- the same value is
# compiled into the public bundle -- but it does have to match between the
# stack and the build, so the source file the app imports is the single place
# it lives and this script reads it from there rather than taking it as an
# argument. Nothing to paste between two systems, and nothing to forget.
token() {
	sed -n "s/^export const BACKUP_TOKEN = '\(.*\)'$/\1/p" "$TOKEN_FILE"
}

TOKEN="$(token)"

if [ -z "$TOKEN" ]; then
	echo "==> no backup token in $TOKEN_FILE -- generating one"

	TOKEN="$(openssl rand -hex 24)"

	# Rewritten in place rather than appended, so rotating (blank the value,
	# re-run) cannot leave two assignments with the stale one winning.
	tmp="$(mktemp)"
	sed "s|^export const BACKUP_TOKEN = .*$|export const BACKUP_TOKEN = '$TOKEN'|" \
		"$TOKEN_FILE" > "$tmp"
	mv "$tmp" "$TOKEN_FILE"

	if [ "$(token)" != "$TOKEN" ]; then
		echo "Could not write the token into $TOKEN_FILE -- has the line changed shape?" >&2
		exit 1
	fi
fi

# Budget alerts go to an address, and this repo is public, so the address is
# never stored in it. Passed once via BUDGET_ALERT_EMAIL; after that it is read
# back off the stack, because `cloudformation deploy` falls back to a
# parameter's template default for anything it is not given and would silently
# switch the alarm off on every later run.
EMAIL="${BUDGET_ALERT_EMAIL:-}"

if [ -z "$EMAIL" ]; then
	EMAIL="$(
		aws cloudformation describe-stacks \
			--stack-name "$STACK" --region "$REGION" \
			--query "Stacks[0].Parameters[?ParameterKey=='BudgetAlertEmail'].ParameterValue" \
			--output text 2>/dev/null || true
	)"
	[ "$EMAIL" = "None" ] && EMAIL=""
fi

# The budget is scoped to this project by cost allocation tag rather than
# covering the account, which runs other and larger things. CloudFormation
# propagates a stack tag to every resource that supports tagging, so this one
# argument is what makes the filter in the template match anything at all --
# keep the value in step with the CostFilters entry there.
aws cloudformation deploy \
	--template-file infra/hosting.yaml \
	--stack-name "$STACK" \
	--region "$REGION" \
	--capabilities CAPABILITY_IAM \
	--no-fail-on-empty-changeset \
	--tags Project=pantry \
	--parameter-overrides "BackupToken=$TOKEN" "BudgetAlertEmail=$EMAIL"

# Tagging a resource is not enough on its own: a user-defined tag does nothing
# for billing until it is activated as a cost allocation tag, and there is no
# CloudFormation resource for that. Cost Explorer is a global service pinned to
# us-east-1. Activation is not retroactive and can take up to 24 hours to show
# up, so a new stack has a blind first day -- and this needs billing
# permissions the deploy itself does not, hence best-effort with a real message
# rather than a failed run.
if [ -n "$EMAIL" ]; then
	if aws ce update-cost-allocation-tags-status \
		--region us-east-1 \
		--cost-allocation-tags-status TagKey=Project,Status=Active >/dev/null 2>&1; then
		echo "==> 'Project' activated as a cost allocation tag"
	else
		echo "==> could not activate the 'Project' cost allocation tag (needs billing access)."
		echo "    Until it is active the budget filter matches nothing. Activate it at:"
		echo "    Billing and Cost Management -> Cost allocation tags -> Project -> Activate"
	fi
fi

echo
aws cloudformation describe-stacks \
	--stack-name "$STACK" --region "$REGION" \
	--query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
	--output table

echo
echo "Backup token is in $TOKEN_FILE and now matches the stack."
echo "Commit it, or CI ships a bundle that cannot reach its own backup."

if [ -z "$EMAIL" ]; then
	echo
	echo "No budget alarm: re-run once with an address to switch it on."
	echo "  BUDGET_ALERT_EMAIL=you@example.com npm run infra"
fi
