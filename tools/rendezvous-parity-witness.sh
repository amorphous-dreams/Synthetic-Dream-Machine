#!/usr/bin/env bash
# rendezvous-parity-witness — the TS and PY sides resolve the SAME meeting place.
#
# TWO LANGUAGES DERIVE ONE ADDRESS. The daemon binds it from TypeScript; the MCP holder and every
# py-side verb dial it from `lares_uds`. Nothing but agreement joins them: no import crosses the
# seam, no type spans it, and the typechecker cannot see one half of it at all.
#
# The rendezvous stands at `/tmp/lares-<uid>/<sha256(root)[0:12]>.sock`, which holds a fixed 40 bytes
# however deep the root runs. A py side that drifts from the TS derivation meets a socket nothing
# created, while the daemon serves on and every other witness stays green.
#
# So this collides the two derivations directly under named house roots, and checks that an unnamed root
# refuses on BOTH sides rather than either one guessing a home. A drift is the whole surface going dark.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0

# DIST-FRESHNESS PREFLIGHT. Every inline import below reads `packages/lararium-mesh/dist` and
# `packages/lararium-node/dist` BY PATH, outside `distModule`'s own guard — so this witness checks
# the one digest itself before trusting either side's reading. The exit code is read directly, never
# through a pipe, so a refusal here reads 2 and names its cure rather than silently falling through
# into comparing two stale readings against each other.
node tools/corpus-read.mjs --assert-fresh \
  packages/lararium-mesh/dist/rendezvous-path.js \
  packages/lararium-node/dist/src/vessel-paths.js

# ── THE THIRD SPELLING ──────────────────────────────────────────────────────────────────────────
# TS and python were gated against each other while the E2E HARNESS carried a third derivation
# nobody checked — it walked an instance root hunting a file named `lares.sock`, found nothing, and
# nine vectors across the join ceremony and the herm floor reported broken CEREMONIES for a rig that
# never reached them. A shared address needs one derivation used by EVERY side, harnesses included.
harness_check() {
  local root="$1"
  local from_harness from_connector
  from_harness=$(node --input-type=module -e '
    import { rendezvousPath } from "./packages/lararium-mesh/dist/rendezvous-path.js";
    import { join } from "node:path";
    const root = process.argv[1];
    // The harness derivation: substrate dir = <LAR_ROOT>/hearth/vessel (tests/harness/instance.ts).
    process.stdout.write(rendezvousPath({ root: join(root, "hearth", "vessel"), uid: process.getuid() }));
  ' "$root")
  from_connector=$(env LAR_ROOT="$root" node --input-type=module -e '
    import { rendezvousPath } from "./packages/lararium-mesh/dist/rendezvous-path.js";
    import { larDataDir }     from "./packages/lararium-node/dist/src/vessel-paths.js";
    process.stdout.write(rendezvousPath({ root: larDataDir(), uid: process.getuid() }));
  ')
  printf '  %-30s %s\n' "harness (staged root)" "$from_harness"
  if [ "$from_harness" = "$from_connector" ]; then
    printf '  %-30s agree\n' "harness vs connector"
  else
    printf '  %-30s DRIFT — connector says %s\n' "harness vs connector" "$from_connector"; fail=1
  fi
}

check() {
  local label="$1"; shift
  local ts py
  ts=$(env "$@" node --input-type=module -e '
    import { rendezvousPath } from "./packages/lararium-mesh/dist/rendezvous-path.js";
    import { larDataDir }     from "./packages/lararium-node/dist/src/vessel-paths.js";
    process.stdout.write(rendezvousPath({ root: larDataDir(), uid: process.getuid() }));
  ')
  py=$(env "$@" python3 -c '
import sys; sys.path.insert(0, "packages/lararium-sensorium/scripts")
import lares_uds as uds; sys.stdout.write(uds.socket_path())
  ')
  if [[ "$ts" == "$py" ]]; then
    echo "  ok    $label  $ts"
  else
    echo "  DRIFT $label"
    echo "        ts: $ts"
    echo "        py: $py"
    fail=1
  fi
}

# AN UNNAMED ROOT REFUSES ON BOTH SIDES. Neither tongue guesses a home, so neither can meet at a socket the other
# never derived: each exits non-zero naming LAR_ROOT.
refuses() {
  local label="$1"; shift
  local ts_rc=0 py_rc=0 ts_err py_err
  ts_err=$(env "$@" node --input-type=module -e '
    import { larDataDir } from "./packages/lararium-node/dist/src/vessel-paths.js";
    larDataDir();
  ' 2>&1 >/dev/null) || ts_rc=$?
  py_err=$(env "$@" python3 -c '
import sys; sys.path.insert(0, "packages/lararium-sensorium/scripts")
import lares_uds as uds; uds.socket_path()
  ' 2>&1 >/dev/null) || py_rc=$?
  if (( ts_rc != 0 && py_rc != 0 )) && [[ "$ts_err" == *LAR_ROOT* && "$py_err" == *LAR_ROOT* ]]; then
    echo "  ok    $label  both refuse, naming LAR_ROOT"
  else
    echo "  DRIFT $label  ts rc=$ts_rc py rc=$py_rc — an unnamed root must refuse on both sides"
    fail=1
  fi
}

echo "rendezvous-parity: the daemon binds it, the py holder dials it"
refuses "unnamed root  " -u LAR_ROOT XDG_DATA_HOME="/tmp/lares-rendezvous-parity-xdg"
refuses "blank root    " LAR_ROOT="   "
check "named root    " LAR_ROOT="/tmp/lares-rendezvous-parity-probe"
check "padded root   " LAR_ROOT="/tmp/lares-rendezvous-parity-probe "

# THE BUDGET IS PART OF THE AGREEMENT. A path both sides spell identically still fails to bind if it
# outruns `sun_path`, and the whole point of the rendezvous is that it cannot.
deep="/tmp/$(printf 'd%.0s' {1..60})/nested/root"
len=$(env LAR_ROOT="$deep" python3 -c '
import sys; sys.path.insert(0, "packages/lararium-sensorium/scripts")
import lares_uds as uds; print(len(uds.socket_path().encode("utf-8")))
')
if (( len < 104 )); then
  echo "  ok    sun_path budget  ${len} bytes under a 60-deep root"
else
  echo "  OVER  sun_path budget  ${len} bytes — a deep root takes the rendezvous down"
  fail=1
fi

harness_check "/tmp/lares-staged-parity-probe"

if (( fail == 0 )); then echo "rendezvous-parity: clean"; else echo "rendezvous-parity: DRIFT"; fi
exit $fail
