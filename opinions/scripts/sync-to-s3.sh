#!/bin/zsh

set -euo pipefail

# Hardcoded CloudFront Distribution ID
CF_DISTRIBUTION_ID="E2U16NO7NSYNDZ"
SCRIPT_DIR=${0:A:h}
OPINIONS_ROOT=${SCRIPT_DIR:h}
BUCKET=s3://opinions.jurisware.com

echo "Syncing to S3..."
for opinion_dir in scotus coa ad3 albany; do
  if [[ ! -d "$OPINIONS_ROOT/$opinion_dir" ]]; then
    echo "Skipping missing local directory: $OPINIONS_ROOT/$opinion_dir"
    continue
  fi

  aws s3 sync "$OPINIONS_ROOT/$opinion_dir" "$BUCKET/$opinion_dir" \
    --delete \
    --exclude "*" \
    --include "*.md" \
    --include "*.json" \
    --include "*.pdf" \
    --cache-control "public, max-age=0, must-revalidate"
done

echo "Creating CloudFront invalidation..."
aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/coa/*" "/*.md"

echo "Done."
