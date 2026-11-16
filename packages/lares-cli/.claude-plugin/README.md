# lares-wake

The Lares boot **entry point**, as a Claude Code plugin.

On every `SessionStart`, `hooks/lares-wake-hook.mjs` starts three reads together and carries their answers into the session:

- **the vessel observation** — `tools/lares-container.sh vessel stand --observe --json`; it observes and never stands a vessel;
- **the memory index** — `tools/lares-container.sh wiki filter '[tag[stage/index]]' --recipe default --fields title,description --limit 32 --max-bytes 4096 --json`, printed as `Lares memory index: <N> rows`, one `<title> — <description>` line per row, and one line naming the call that reads further; a fault prints `memory index unread: <cause>`, and a vessel that answers no "up" skips the read;
- **the homes line** — `lares home read --brief`.
- **the lei** — `lares lei show --rite <push|kukulu> --branch <branch> --head <sha> --json` through the shim, one read per rite at the checkout's branch (`git rev-parse HEAD --abbrev-ref HEAD`), printed as `Lares lei: this session wears <rite> … at <branch>@<head>` (or `none worn`); a locked vessel prints the operator's call (run `lares vault unlock`; tell the operator by the harness's push notification);
- **the tessera conferre** — `lares rite receipts --json` through the shim, each guest half (`rite-begun`) set against its host half (`rite-landed`), printed as `Lares tessera conferre: N par, M red (no match): …`. Both doors stand behind ports; a runner that answers neither leaves their lines out.

Before a compaction, `hooks/lares-compact-hook.mjs` (`PreCompact`) prints the same index and the rows in play (the open ledger, the standing orders) by `lar:` address; Claude Code appends that text to the compaction's instructions. The wake fires again on the session start that follows a compaction and prints both into the new context. What either hook says lives in `hooks/lares-wake-core.mjs`.

At a session's end, `hooks/lares-keep-hook.mjs` (`SessionEnd`) starts `lares rite keep --if-due` and leaves at once: the keep carries the house and this device's Claude Code sessions into the operator's repo under a keep lei, each push spending one return. Its lines land in `$XDG_STATE_HOME/lares/keep-hook.log` (the last run alone); a keep with no workspace named, or with nothing moved, keeps nothing.

The static `CLAUDE.md` @-import carries the canonical seed (always-true); this plugin grounds it in live state (true-right-now). A degraded wake never blocks the session — it exits 0 with each read's own cause in the frame, inside one 12-second budget under the harness's 15.

**Install:** `/plugin marketplace add <this repo>` → `/plugin install lares-wake`, or run `lares home tend`, which seats both hooks in `~/.claude/settings.json` from the main clone.

**Founding vs joining:**
- `lares vessel stand --init` — found a *first* vessel (build · init · genesis, each found-if-absent; genesis never rebuilt; keypair never wiped). It writes `LAR_ROOT` alone; `lares home tend` keeps the operator's homes.
- `lares vessel stand --admit <payload>` — stand up a *joining* vessel into an existing operator PersonGroup (same idempotent standup; the init step joins from a `device-admit` payload).

**Federating a second vessel** (out-of-band identity transmit + the device-admit flow) is written up at the meme `lar:///ha.ka.ba/lares/docs/federation` (`bags/lares/ha.ka.ba/lares/docs/federation.md`). Note: `social-bootstrap.json` and the operator key are identity-bearing — gitignored, never committed, transmitted out-of-band only.
