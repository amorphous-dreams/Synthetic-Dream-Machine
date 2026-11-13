#!/usr/bin/env bash
# The separate held-out cell walks A's charter roll between the two herm join waves.
set -euo pipefail
cd "$(dirname "$0")/.."
HERM_MESH_ROLL=1 exec bash tools/herm-mesh-witness.sh
