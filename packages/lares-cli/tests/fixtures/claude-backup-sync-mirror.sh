#!/usr/bin/env bash
# The operator's claude-backup `bin/sync`, its mirror half, copied line for line: the device identity, the config allow-list, the
# sanitized ~/.claude.json, the state and the per-project memory and transcripts. The lock, the secret scan and git stay out. The
# keep's session mirror (`src/keep-sessions.ts`) reads par against what this writes (`tests/keep-sessions.test.ts`).
# REPO rides the first argument; every other source rides the environment, as in the original.
set -euo pipefail
REPO="$1"
SRC="${CLAUDE_HOME:-$HOME/.claude}"
CLAUDE_JSON="${CLAUDE_JSON:-$HOME/.claude.json}"
IDLE_MIN="${IDLE_MIN:-10}"

# ── Device identity ──────────────────────────────────────────────────────────────────────────────
# A UUIDv5 derived once from this OS install's machine-id and kept in ~/.config, so a hostname change
# or a second machine with the same name never lands in another device's directory.
ID_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/claude-backup/device.json"
if [ ! -f "$ID_FILE" ]; then
  mkdir -p "$(dirname "$ID_FILE")"
  python3 - "$ID_FILE" <<'EOF'
import json, os, platform, socket, sys, uuid
seed = ""
for p in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
    if os.path.exists(p):
        seed = open(p).read().strip(); break
seed = seed or str(uuid.uuid4())          # no machine-id: a random, still-unique identity
host = socket.gethostname()
dev = {
    "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, f"claude-backup:{seed}")),
    "name": host.lower(),
    "hostname": host,
    "os": f"{platform.system()} {platform.release()}",
}
json.dump(dev, open(sys.argv[1], "w"), indent=2)
EOF
fi
field() { python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))[sys.argv[2]])' "$1" "$2"; }
UUID="$(field "$ID_FILE" uuid)"
DEVICE="$(field "$ID_FILE" name)-${UUID:0:8}"
DEST="$REPO/devices/$DEVICE"

# Refuse to write into a directory another device owns.
if [ -f "$DEST/DEVICE.json" ] && [ "$(field "$DEST/DEVICE.json" uuid)" != "$UUID" ]; then
  echo "devices/$DEVICE belongs to another device; refusing"; exit 1
fi
mkdir -p "$DEST/config" "$DEST/projects" "$DEST/state"
cp "$ID_FILE" "$DEST/DEVICE.json"

# ── Config: an explicit allow-list, never the whole home ───────────────────────────────────────────
for f in "$SRC"/CLAUDE.md "$SRC"/settings.json "$SRC"/settings.local.json "$SRC"/settings.json.bak*; do
  [ -f "$f" ] && cp -p "$f" "$DEST/config/"
done
for d in rules skills plans agents; do
  [ -d "$SRC/$d" ] && rsync -a --delete "$SRC/$d/" "$DEST/config/$d/"
done
mkdir -p "$DEST/config/plugins"
for f in installed_plugins.json known_marketplaces.json; do
  [ -f "$SRC/plugins/$f" ] && cp -p "$SRC/plugins/$f" "$DEST/config/plugins/$f"
done
[ -d "$SRC/plugins/data" ] && rsync -a --delete "$SRC/plugins/data/" "$DEST/config/plugins/data/"

# ~/.claude.json, sanitized: account identity and secret-bearing values never leave the device.
if [ -f "$CLAUDE_JSON" ]; then
  python3 - "$CLAUDE_JSON" "$DEST/config/claude.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1]))
DROP = {"oauthAccount", "userID", "rcLongTurnNudgeSeenKey", "remoteControlReadyPushKey"}
d = {k: v for k, v in d.items() if k not in DROP and not k.startswith("cached")}
def redact(servers):
    for s in (servers or {}).values():
        for field in ("env", "headers"):
            if isinstance(s.get(field), dict):
                s[field] = {k: "<redacted>" for k in s[field]}
redact(d.get("mcpServers"))
for p in (d.get("projects") or {}).values():
    redact(p.get("mcpServers"))
json.dump(d, open(sys.argv[2], "w"), indent=2, sort_keys=True)
EOF
fi

# ── State: prompt history, task lists, stats, feedback drafts, background-job state ────────────────
for f in history.jsonl stats-cache.json; do
  [ -f "$SRC/$f" ] && cp -p "$SRC/$f" "$DEST/state/$f"
done
for d in tasks feedback state; do
  [ -d "$SRC/$d" ] && rsync -a --delete "$SRC/$d/" "$DEST/state/$d/"
done
[ -d "$SRC/jobs" ] && rsync -a --delete --include='*/' --include='state.json' --exclude='*' --prune-empty-dirs "$SRC/jobs/" "$DEST/state/jobs/"

# ── Per project: memory as plain text; transcripts compressed once idle ─────────────────────────────
for p in "$SRC"/projects/*/; do
  name="$(basename "$p")"
  out="$DEST/projects/$name"
  [ -d "$p/memory" ] && { mkdir -p "$out/memory"; rsync -a --delete "$p/memory/" "$out/memory/"; }
  while IFS= read -r -d '' f; do
    rel="${f#"$p"}"
    target="$out/sessions/$rel.zst"
    if [ ! -f "$target" ] || [ "$f" -nt "$target" ]; then
      mkdir -p "$(dirname "$target")"
      zstd -q -9 -T0 -f "$f" -o "$target.tmp" && mv "$target.tmp" "$target"
    fi
  done < <(find "$p" -type f -name '*.jsonl' -mmin +"$IDLE_MIN" -print0)
done

