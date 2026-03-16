#!/bin/zsh

set -euo pipefail

REPO_ROOT=.
BUCKET=s3://opinions.jurisware.com

git add .
git commit -m "Update opinion(s)"
git push

for opinion_dir in scotus coa ad3 albany; do
  if [[ ! -d "$REPO_ROOT/$opinion_dir" ]]; then
    echo "Skipping missing local directory: $REPO_ROOT/$opinion_dir"
    continue
  fi

  aws s3 sync "$REPO_ROOT/$opinion_dir" "$BUCKET/$opinion_dir" \
    --delete \
    --exclude "*" \
    --include "*.md" \
    --include "*.pdf" \
    --cache-control "public, max-age=0, must-revalidate"
done

# Set CF_DISTRIBUTION_ID in your shell/profile to enable invalidation.
if [[ -n "${CF_DISTRIBUTION_ID:-}" ]]; then
  aws cloudfront create-invalidation \
    --distribution-id "${CF_DISTRIBUTION_ID}" \
    --paths "/coa/*" "/*.md"
else
  echo "Skipping CloudFront invalidation: CF_DISTRIBUTION_ID is not set."
fi
