#!/usr/bin/env bash
set -euo pipefail

# Render selected PDF pages to PNG images for OCR-heavy review.
# Usage:
#   scripts/render_becmi_pages_png.sh <pdf_path> <pages_spec> [out_dir] [dpi]
# Example:
#   scripts/render_becmi_pages_png.sh "_becmi/TSR 1011B - Set 1 Basic Rules.pdf" "35,40-44" "_todo/_page_renders/.cache/basic" 220

if [[ $# -lt 2 || $# -gt 4 ]]; then
  echo "Usage: $0 <pdf_path> <pages_spec> [out_dir] [dpi]" >&2
  exit 1
fi

pdf_path="$1"
pages_spec="$2"
dpi="${4:-220}"

# Default render output is a gitignored cache path.
out_dir="${3:-_todo/_page_renders/.cache}"

if [[ ! -f "$pdf_path" ]]; then
  echo "PDF not found: $pdf_path" >&2
  exit 1
fi

if ! command -v pdftoppm >/dev/null 2>&1; then
  echo "pdftoppm is required but not installed." >&2
  exit 1
fi

if ! [[ "$dpi" =~ ^[0-9]+$ ]]; then
  echo "DPI must be an integer: $dpi" >&2
  exit 1
fi

mkdir -p "$out_dir"

base_name="$(basename "$pdf_path")"
base_name="${base_name%.pdf}"
base_name="${base_name// /_}"

# Expand pages spec like: 35,40-44,51
page_list=()
IFS=',' read -r -a tokens <<< "$pages_spec"
for token in "${tokens[@]}"; do
  token="${token// /}"
  if [[ "$token" =~ ^[0-9]+$ ]]; then
    page_list+=("$token")
  elif [[ "$token" =~ ^([0-9]+)-([0-9]+)$ ]]; then
    start="${BASH_REMATCH[1]}"
    end="${BASH_REMATCH[2]}"
    if (( end < start )); then
      echo "Invalid range: $token" >&2
      exit 1
    fi
    for ((p=start; p<=end; p++)); do
      page_list+=("$p")
    done
  else
    echo "Invalid pages spec token: $token" >&2
    exit 1
  fi
done

# De-duplicate while preserving order.
ordered_unique_pages=()
seen=""
for p in "${page_list[@]}"; do
  marker="|$p|"
  if [[ "$seen" != *"$marker"* ]]; then
    ordered_unique_pages+=("$p")
    seen+="$marker"
  fi
done

for p in "${ordered_unique_pages[@]}"; do
  page_tag=$(printf "%03d" "$p")
  out_prefix="$out_dir/${base_name}_p${page_tag}"
  pdftoppm -r "$dpi" -f "$p" -l "$p" -singlefile -png "$pdf_path" "$out_prefix" >/dev/null 2>&1
  echo "Wrote ${out_prefix}.png"
done
