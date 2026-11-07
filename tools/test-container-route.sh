#!/bin/sh
# Harness calls only: staging alone grants no process-local read-back stand-in.
# The product image neither copies this helper nor sets LARES_TEST_FOUNDING.
test_container_route() {
  if [ -n "${LAR_STAGE_DIR:-}" ] && [ "${LARES_TEST_FOUNDING:-}" = 1 ]; then
    NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import=file:///app/tools/test-ward-route.mjs" "$@"
  else
    "$@"
  fi
}

# A witness may invoke the same guarded route for a later face founding or card roll.
if [ "${0##*/}" = test-container-route.sh ]; then
  test_container_route "$@"
fi
