#!/usr/bin/env bash
# Hand-run only: prepare a disposable seat for an operator's fresh-session delivery experiment.
# This script has no CI caller and never changes host configuration.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
house=$(mktemp -d "${TMPDIR:-/tmp}/seat-delivery.XXXXXXXX")
nonce=$(python3 -c 'import secrets; print(secrets.token_hex(16))')
mkdir -p "$house/seat"
python3 - "$repo" "$house/seat/lares_mcp.py" "$nonce" <<'PY'
import pathlib, sys
repo, target, nonce = sys.argv[1:]
source = pathlib.Path(repo) / 'packages/lararium-sensorium/scripts/lares_mcp.py'
text = source.read_text()
needle = 'SEAT_LEAD = (\n'
assert text.count(needle) == 1
text = text.replace(needle, needle + f'    "\\nNONCE {nonce}\\n"\n', 1)
pathlib.Path(target).write_text(text)
PY
printf 'Scratch LAR_ROOT: %s\nScratch seat: %s/seat/lares_mcp.py\n' "$house" "$house"
printf '%s\n' 'Stand the scratch vessel first:'
printf 'node %q %q && node %q %q && LAR_ROOT=%q node %q vessel found hearth=true name=seat-delivery skip-build=true && LAR_ROOT=%q node %q vessel stand init=true skip-build=true\n' \
  "$repo/tools/test-scratch-marker.mjs" "$house" "$repo/tools/seed-test-custody.mjs" "$house" "$house" "$repo/packages/lares-cli/bin/lares.mjs" "$house" "$repo/packages/lares-cli/bin/lares.mjs"
printf '%s\n' 'Then launch a fresh session with:'
python3 - "$repo" "$house" <<'PYCOMMAND'
import json, pathlib, shlex, sys
repo, house = sys.argv[1:]
scripts = str(pathlib.Path(repo) / 'packages/lararium-sensorium/scripts')
seat = str(pathlib.Path(house) / 'seat/lares_mcp.py')
config = {'mcpServers': {'lares': {'command': sys.executable, 'args': [seat],
          'env': {'LAR_ROOT': house, 'PYTHONPATH': scripts,
                  'LARES_AFFORDANCE_PACK': str(pathlib.Path(repo) / 'packages/lararium-tw5/affordance-pack.json')}}}}
print('LAR_ROOT=' + shlex.quote(house) + ' claude --strict-mcp-config --mcp-config ' + shlex.quote(json.dumps(config)))
PYCOMMAND
printf '%s\n' 'Ask the main session exactly: quote the line that starts NONCE'
printf '%s\n' 'Inspect the host stored view with: claude mcp get lares' 'Inspect the session view with: /mcp'
