#!/bin/sh
# harness-image — name the product image a container harness runs, by digest.
#
#   harness-image.sh             build `Dockerfile` target `serve`, then print the image id (`sha256:…`)
#   harness-image.sh --no-build  print the id of the tag as it stands; refuse by name when the tag stands absent
#   harness-image.sh --resolve   print LARES_HARNESS_IMAGE when the caller set it (refusing a value that names no
#                                digest), else build and print as the bare form does
#
# A harness proves the code a household runs only when it runs that code, so every harness compose file reads
# LARES_HARNESS_IMAGE and every witness resolves it here, once. A digest names bytes; a tag names whatever was
# built last. Build output goes to stderr; stdout carries the one reference.
#   LARES_HARNESS_TAG   the tag the build writes and the id gets read from (default lares-harness:local)
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TAG=${LARES_HARNESS_TAG:-lares-harness:local}
MODE=${1:-}
if [ "$#" -gt 1 ]; then echo "usage: tools/harness-image.sh [--no-build | --resolve]" >&2; exit 2; fi
case "$MODE" in ""|--no-build|--resolve) ;; *) echo "usage: tools/harness-image.sh [--no-build | --resolve]" >&2; exit 2 ;; esac

names_digest() { printf '%s\n' "$1" | grep -Eq '^(sha256:[0-9a-f]{64}|[^@[:space:]]+@sha256:[0-9a-f]{64})$'; }

if [ "$MODE" = "--resolve" ] && [ "${LARES_HARNESS_IMAGE+x}" = x ]; then
  if ! names_digest "$LARES_HARNESS_IMAGE"; then
    echo "harness-image: LARES_HARNESS_IMAGE must name a digest (sha256:<64 hex> or name@sha256:<64 hex>): $LARES_HARNESS_IMAGE" >&2
    exit 2
  fi
  printf '%s\n' "$LARES_HARNESS_IMAGE"
  exit 0
fi

if [ "$MODE" != "--no-build" ]; then
  docker build --target serve --tag "$TAG" --file "$ROOT/Dockerfile" "$ROOT" >&2
fi

if ! IMAGE_ID=$(docker image inspect --format '{{.Id}}' "$TAG" 2>/dev/null); then
  echo "harness-image: the tag '$TAG' stands absent; run tools/harness-image.sh to build it" >&2
  exit 1
fi
if ! printf '%s\n' "$IMAGE_ID" | grep -Eq '^sha256:[0-9a-f]{64}$'; then
  echo "harness-image: the tag '$TAG' answered no image id: $IMAGE_ID" >&2
  exit 1
fi
printf '%s\n' "$IMAGE_ID"
