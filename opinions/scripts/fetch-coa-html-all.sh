#!/bin/zsh

set -euo pipefail

script_dir=${0:A:h}
repo_root=${script_dir:h}
fetch_script="$script_dir/fetch-coa-html.sh"
html_dir="$repo_root/html"

if [[ ! -x "$fetch_script" ]]; then
  echo "Required script is missing or not executable: $fetch_script" >&2
  exit 1
fi

for year in {2003..2023}; do
  url_file="$html_dir/$year.url"

  if [[ ! -f "$url_file" ]]; then
    echo "Skipping missing URL file: $url_file" >&2
    continue
  fi

  echo "Processing $url_file"
  "$fetch_script" "$url_file"
done
