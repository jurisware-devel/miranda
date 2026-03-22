#!/bin/bash

DEST="/Users/jonathan/Projects/miranda/opinions/coa/ny3d"
BASE="https://nycourts.gov/reporter/files/bv"

mkdir -p "$DEST"

for i in $(seq -w 1 43); do
    FILE="${i}NY3d.pdf"
    URL="${BASE}/${FILE}"
    OUT="${DEST}/${FILE}"

    echo "Downloading $FILE..."

    lynx -source "$URL" > "$OUT"

    # Validate it's actually a PDF
    if file "$OUT" | grep -q "PDF"; then
        echo "✅ Valid PDF"
    else
        echo "⚠️ Not a PDF — likely blocked"
    fi
done

echo "Done."
