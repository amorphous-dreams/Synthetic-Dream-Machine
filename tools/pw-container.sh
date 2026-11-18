#!/usr/bin/env bash
# pw-container — run one command inside the pinned official Playwright image, on the host's workspace.
#
# WHY IT EXISTS. `playwright install-deps` is an apt step, and apt on a hosted runner stalled past its five minutes at least
# six times in one day. The official image carries the system libraries and all three engines already, so a browser step
# that runs here installs nothing. The image is pinned by tag AND digest (`PW_IMAGE`, the workflows' `PLAYWRIGHT_IMAGE`),
# and tools/workflow-law.test.mjs holds that pin to the repo's `playwright` version and to docker-compose.capability-probe.yml.
#
# THIS IS NOT A SANDBOX. The container shares the host network and IPC, mounts the workspace writable and runs as the caller's
# uid: it supplies system libraries and engines, and nothing more. A step must not run untrusted code here on the strength of it.
# Only the workspace (its .git read-only) and the paths named in `PW_MOUNTS` are mounted: never the runner's whole temp dir
# (which holds the runner's file-command and credential files).
#
# WHAT IT CHANGES, AND WHAT IT LEAVES. The workspace, the runner temp dir and the extra mounts in `PW_MOUNTS` (space-separated
# absolute paths) ride in at their own paths, so every path a step names reads the same inside. The command runs as the
# caller's uid and gid (nothing root-owned lands in the workspace) on the host network (a dev server on localhost answers).
# HOME becomes a scratch dir unless the caller sets one; `PW_ENV` (space-separated names) lists the variables to forward.
#
# Usage:  PW_IMAGE=<image> tools/pw-container.sh <command> [args...]
set -euo pipefail

image="${PW_IMAGE:?pw-container: PW_IMAGE names the pinned Playwright image}"
[ "$#" -gt 0 ] || { echo "pw-container: no command" >&2; exit 2; }

# THE ONE IMAGE. The pin is read from the file tools/workflow-law.test.mjs reads, and `PW_IMAGE` must EQUAL it: a caller
# can name the image but never swap it, so an unpinned tag, a changed digest or another image refuses before docker runs.
root="$(git rev-parse --show-toplevel)"
pin="$(grep -oE 'mcr\.microsoft\.com/playwright:v[0-9.]+-noble@sha256:[0-9a-f]{64}' "$root/docker-compose.capability-probe.yml" | head -1)"
[ -n "$pin" ] || { echo "pw-container: docker-compose.capability-probe.yml names no pinned Playwright image" >&2; exit 2; }
if [ "$image" != "$pin" ]; then
  echo "pw-container: refusing PW_IMAGE=$image; the one pinned image is $pin" >&2
  exit 2
fi

# The pull is the one network step left; it takes three attempts, each bounded, so a stall names itself.
if ! docker image inspect "$image" >/dev/null 2>&1; then
  pulled=0
  for attempt in 1 2 3; do
    if timeout 300s docker pull --quiet "$image" >/dev/null; then pulled=1; break; fi
    echo "pw-container: pull attempt $attempt failed; retrying" >&2
  done
  [ "$pulled" -eq 1 ] || { echo "pw-container: the image never pulled" >&2; exit 1; }
fi

args=(--rm --network host --ipc=host --init --user "$(id -u):$(id -g)" -w "$(pwd)" -v "$root:$root")
# The repo's own .git rides read-only: no step in the container writes history, and nothing in it needs to.
if [ -d "$root/.git" ]; then args+=(-v "$root/.git:$root/.git:ro"); fi
for m in ${PW_MOUNTS:-}; do args+=(-v "$m:$m"); done
scratch_home="$(mktemp -d)"
trap 'rm -rf "$scratch_home"' EXIT
args+=(-v "$scratch_home:$scratch_home" -e "HOME=${HOME_INSIDE:-$scratch_home}")
if [ -n "${CI:-}" ]; then args+=(-e CI); fi
for v in ${PW_ENV:-}; do
  if [ -n "${!v+x}" ]; then args+=(-e "$v"); fi
done

docker run "${args[@]}" "$image" "$@"
