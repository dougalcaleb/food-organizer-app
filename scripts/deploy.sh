#!/usr/bin/env bash
#
# Publishes dist/ to the S3 bucket behind CloudFront. Used by CI and runnable
# by hand (`npm run deploy`); the workflow calls this file rather than
# repeating the sync flags, so the caching rules have one home.
#
# Reads the bucket and distribution from the CloudFormation stack outputs, so
# there is nothing to keep in sync by hand.
set -euo pipefail

# Git Bash (MSYS) rewrites any argument that looks like an absolute POSIX path
# into a Windows one, so `--paths /index.html` reached CloudFront as
# `C:/Program Files/Git/index.html` and the invalidation was rejected as an
# invalid path. Both variables are inert on the Linux CI runner.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

STACK="${STACK_NAME:-pantry-hosting}"
REGION="${AWS_REGION:-us-east-2}"

if [ ! -f dist/index.html ]; then
	echo "dist/index.html is missing -- run 'npm run build' first." >&2
	exit 1
fi

output() {
	aws cloudformation describe-stacks \
		--stack-name "$STACK" --region "$REGION" \
		--query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
		--output text
}

BUCKET="$(output BucketName)"
DIST_ID="$(output DistributionId)"
SITE_URL="$(output SiteUrl)"

if [ -z "$BUCKET" ] || [ "$BUCKET" = "None" ]; then
	echo "Could not read outputs from stack '$STACK' -- deploy the infra first." >&2
	exit 1
fi

# Files that must never be cached by name. Everything Vite emits into assets/
# carries a content hash and is safe to cache forever; these four do not, and a
# service worker pinned at the edge is the worst thing this CDN could do -- it
# would keep handing an installed app an old precache manifest. robots.txt does
# not exist yet; an --exclude that matches nothing is harmless.
UNHASHED=(index.html sw.js manifest.webmanifest registerSW.js robots.txt)

exclude_args=()
include_args=()
invalidation_paths=()
for f in "${UNHASHED[@]}"; do
	exclude_args+=(--exclude "$f")
	include_args+=(--include "$f")
	invalidation_paths+=("/$f")
done

# public/ is copied verbatim, so icons keep their names across a regeneration
# (`npm run icons`) and an immutable year would pin a replaced icon in any
# browser that had already fetched it. A day suits files that change about
# never, and the edge copies are invalidated on every deploy anyway.
invalidation_paths+=('/icons/*')

# Hashed assets go up FIRST, so index.html is never live while pointing at
# files that have not landed yet. --delete belongs on this pass only: the
# excluded index.html is skipped on both sides, so it is not swept away in the
# window before the second pass replaces it.
echo "==> assets -> s3://$BUCKET"
aws s3 sync dist/ "s3://$BUCKET" \
	--region "$REGION" \
	--delete \
	--cache-control 'public, max-age=31536000, immutable' \
	--exclude 'icons/*' \
	"${exclude_args[@]}"

echo "==> icons -> s3://$BUCKET"
aws s3 sync dist/ "s3://$BUCKET" \
	--region "$REGION" \
	--cache-control 'public, max-age=86400' \
	--exclude '*' \
	--include 'icons/*'

echo "==> entry points -> s3://$BUCKET"
aws s3 sync dist/ "s3://$BUCKET" \
	--region "$REGION" \
	--cache-control 'no-cache' \
	--exclude '*' \
	"${include_args[@]}"

# Only the unhashed files can be stale at the edge; a wholesale /* invalidation
# would throw away a year of correctly-cached assets and eat the monthly free
# invalidation allowance.
echo "==> invalidating ${invalidation_paths[*]}"
aws cloudfront create-invalidation \
	--distribution-id "$DIST_ID" \
	--paths "${invalidation_paths[@]}" \
	--query 'Invalidation.Id' --output text

echo
echo "Deployed: $SITE_URL"
