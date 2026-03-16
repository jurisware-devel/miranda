#!/bin/zsh

set -euo pipefail

SCRIPT_DIR=${0:A:h}
OPINIONS_ROOT=${SCRIPT_DIR:h}
BUCKET=s3://opinions.jurisware.com

for opinion_dir in scotus coa ad3 albany; do
  mkdir -p "$OPINIONS_ROOT/$opinion_dir"

  aws s3 sync "$BUCKET/$opinion_dir" "$OPINIONS_ROOT/$opinion_dir" \
    --delete \
    --exclude "*" \
    --include "*.md" \
    --include "*.json" \
    --include "*.pdf"
done
