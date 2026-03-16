#!/bin/zsh

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 path/to/file.url" >&2
  exit 1
fi

url_file=$1

if [[ ! -f "$url_file" ]]; then
  echo "URL file not found: $url_file" >&2
  exit 1
fi

script_dir=${0:A:h}
repo_root=${script_dir:h}
coa_root="$repo_root/coa"

if ! command -v lynx >/dev/null 2>&1; then
  echo "lynx is required but was not found in PATH" >&2
  exit 1
fi

while IFS= read -r url || [[ -n "$url" ]]; do
  [[ -z "$url" ]] && continue

  if [[ "$url" != http://www.nycourts.gov/reporter/3dseries/*/*.htm && \
        "$url" != https://www.nycourts.gov/reporter/3dseries/*/*.htm ]]; then
    echo "Skipping unrecognized URL: $url" >&2
    continue
  fi

  rel_path=${url#http://www.nycourts.gov/reporter/3dseries/}
  rel_path=${rel_path#https://www.nycourts.gov/reporter/3dseries/}
  year=${rel_path%%/*}
  file_name=${rel_path#*/}
  output_path="$coa_root/$year/$file_name"

  mkdir -p "${output_path:h}"
  echo "Fetching $url -> $output_path"
  lynx -source "$url" > "$output_path"
done < "$url_file"
