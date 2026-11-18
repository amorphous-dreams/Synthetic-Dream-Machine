#!/usr/bin/env bash
# rite-commands-witness — every command the founding rite instructs resolves to a door that answers.
#
# ── WHY THE RITE NEEDS AN INSTRUMENT AND NOT A READER ───────────────────────────────────────────
# The founding runbook is the OPERATOR-INSTRUCTION SOURCE: a human or an agent resolves the next
# command from it, once, on the night a hearth becomes permanent. A stale command there fails at the
# worst moment a command can fail — mid-rite, with the vault sealed.
#
# And it drifts silently. Nothing in a CLI refactor reaches a prose document, so the rite keeps reading
# fluently while naming verbs that do not answer.
#
# So the reading is derived rather than trusted:
#   · every FIRST word must appear in the live `lares help` projection
#   · every SUB-DOOR must appear in its command module's dispatch
#
# It reads the BUILT binary, never the source — the same discipline the surface-parity witness keeps,
# because a typecheck agrees with itself while a stale sibling dist ships a door that cannot load.
#
# NOTHING IS EXECUTED. The rite includes founding procedures; a witness that ran what it checks
# would burn the operator's hearth to prove the command exists.
#
# Exit 0 = every instructed command resolves.
set -uo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PY'
import os, re, json, pathlib, subprocess, sys

# EVERY RITE, not only the founding one. A rite states commands as CLAIMS a reader resolves the next
# move from, and that property belongs to the tending rite too — it asks to be walked end to end, each
# step either running or naming a friction. A rite outside this list drifts unwatched.
RITES = [
    pathlib.Path("bags/lararium/ha.ka.ba/lararium/mesh/founding-runbook.mem"),
    pathlib.Path("bags/lararium/ha.ka.ba/lararium/api/sensorium-runbook.mem"),
]
BIN  = "packages/lares-cli/dist/src/bin/lares.js"
for _r in RITES:
    if not _r.exists():
        print(f"[rite-commands] no rite at {_r}"); sys.exit(1)

help_out = subprocess.run(["node", BIN, "help"], capture_output=True, text=True)
if help_out.returncode != 0 or not help_out.stdout.strip():
    print("[rite-commands] the built binary did not answer `help` — run `pnpm -r build`.")
    print("  A stale sibling dist is the usual cause: the CLI resolves workspace packages from THEIR dist.")
    sys.exit(1)

live = set(re.findall(r'^\s{2,4}(?:\S+ )?([a-z][a-z0-9-]+)\s', help_out.stdout, re.M))
rite = "\n".join(r.read_text() for r in RITES)

cmds = {m.group(1) for m in re.finditer(
    r'(?m)^\s*lares ((?:[a-z][a-z0-9-]*)(?: [a-z][a-z0-9-]*)?)', rite)}

# THE HOST `lares` ANSWERS THE SHIM'S OWN VERBS. With the container house standing, the host's `lares <verb>` hands
# a vessel verb to the shim with the same argv (`packages/lares-cli/src/host-bridge.ts`), and the bridge names the
# verbs the shim alone answers (`SHIM_VERB_HELP`: `lares up --help` reads its row there). So a bare `lares up` in
# a rite claims the shim's door, as a shim line does. The set DERIVES from the bridge's own table, each name held
# against a `<verb>)` case in the shim, so a verb either side drops reads red here by name.
_bridge = pathlib.Path("packages/lares-cli/src/host-bridge.ts").read_text()
_table = re.search(r'const SHIM_VERB_HELP\b[^=]*=\s*\{(.*?)\n\};', _bridge, re.S)
HOST_SHIM = set(re.findall(r'(?m)^\s*([a-z][a-z0-9-]*):\s*\{\s*usage:', _table.group(1))) if _table else set()
if not HOST_SHIM:
    print("[rite-commands] host-bridge.ts PARSED TO ZERO SHIM VERBS — the probe binds `<verb>: { usage:` rows of SHIM_VERB_HELP.")
    sys.exit(1)
_shim = pathlib.Path("tools/lares-container.sh").read_text()
_orphans = sorted(v for v in HOST_SHIM if not re.search(rf'(?m)^\s*{re.escape(v)}\)', _shim))
if _orphans:
    print(f"[rite-commands] the host bridge names shim verbs the shim holds no case for: {', '.join(_orphans)}")
    sys.exit(1)
_bare_shim = {c for c in cmds if c.split()[0] in HOST_SHIM}
cmds -= _bare_shim
if any(c.split()[0] == "found" for c in _bare_shim):
    cmds.add("vessel found")

# A rite that walks the container instructs through the HOST SHIM. The shim answers some verbs itself (the engine's
# up, down, logs, build; reset, which clears the hearth on the host; the pūlama's own verb; image-digest), spells the
# founding act `found`, and hands every other word to the CLI. So a shim line claims a CLI door exactly as a bare
# `lares` line does, unless the shim's own arm answers it.
#
# THE SHIM'S OWN VERBS DERIVE FROM ITS DISPATCH. Each top-level arm of the shim's `case "$verb" in` either hands the
# word to the CLI (`route_cli`, or `waited_run` for `found`) or answers it on the host. An arm that names neither hands
# nothing to the CLI, so it stands as the shim's own door, and a sub-word the rite gives it must name a branch in that
# arm's own nested `case` (`pulama admit` reads `admit)`). A shim verb added later joins without a hand edit, and a
# sub-word the arm drops reads red here by name. The PowerShell shim keeps the same verbs (both shims answer one
# surface), so the bash shim's dispatch carries the reading for both spellings.
shim_fail = []
_main = re.search(r'(?ms)^case "\$verb" in\n(.*?)^esac', _shim)
if not _main:
    print("[rite-commands] tools/lares-container.sh PARSED TO NO VERB DISPATCH — the probe binds its `case \"$verb\" in` … `esac`.")
    sys.exit(1)
_arms = {}
_spans = list(re.finditer(r'(?m)^  ([a-z][a-z0-9|-]*)\)', _main.group(1)))
for _i, _a in enumerate(_spans):
    _end = _spans[_i + 1].start() if _i + 1 < len(_spans) else len(_main.group(1))
    _body = _main.group(1)[_a.end():_end]
    for _name in _a.group(1).split("|"):
        _arms[_name] = _body
SHIM_OWN = {v for v, b in _arms.items() if not re.search(r'\b(?:route_cli|waited_run)\b', b)}
if not SHIM_OWN:
    print("[rite-commands] tools/lares-container.sh PARSED TO ZERO OWN VERBS — the probe reads arms that call no `route_cli`.")
    sys.exit(1)
for m in re.finditer(
        r'(?m)^\s*tools/lares-container\.(?:sh|ps1) ((?:[a-z][a-z0-9-]*)(?: [a-z][a-z0-9-]*)?)', rite):
    words = m.group(1).split()
    if words[0] in SHIM_OWN:
        if len(words) > 1 and not re.search(
                rf'(?m)^\s*(?:[a-z][a-z0-9-]*\|)*{re.escape(words[1])}(?:\|[a-z][a-z0-9-]*)*\)', _arms[words[0]]):
            shim_fail.append(f"{m.group(1)!r} — `{words[1]}` names no branch in the shim's own `{words[0]})` arm")
        continue
    cmds.add("vessel found" if words[0] == "found" else m.group(1))
cmds = sorted(cmds)

CMDS_DIR = pathlib.Path("packages/lares-cli/src/commands")
fail, subs_checked = list(shim_fail), 0

# ── A SUB-DOOR READS AT A DISPATCH POSITION, NEVER AS A LOOSE STRING ────────────────────────────
# Three shapes carry every dispatch in this CLI, and the VALUE side is half of each:
#   · a `switch` case                         — `case "seal":`
#   · a dispatch-map entry                    — `found: { summary … }` · `refresh: cmdRiteRefresh`
#   · a comparison against the sub-door name  — `if (sub !== "sign")`
#
# Matching a quoted literal ANYWHERE in the module is what a substring test does, and it passes on the
# very line that disproves it: `case "contract": return await cmdContract(args, "admit")` carries the
# word `admit` as an ARGUMENT, so a rite instructing `lares nexus admit` read GREEN against a door that
# answers `unknown verb "admit"`.
#
# The value side matters just as much when COUNTING. `emit()` payloads write `data:`, `human:` and
# `error:` in every module alive, so a key-shaped match with no value test reports the CLI's object
# vocabulary and calls it a surface — 220 verbs where the doors answer far fewer. Requiring a handler
# or a dispatch record on the right of the colon is what keeps the figure a reading rather than a proxy.
_HANDLER = r'(?:cmd[A-Za-z]|run[A-Z]|\{\s*(?:summary|composes|run|handler)\b)'
# The comparison form binds to the sub-door VARIABLE, never to any `=== "x"` in the file: `nexus.ts`
# carries `action === "admit"` over an INTERNAL parameter, and a loose comparison test waved the same
# ghost door through that the substring test did.
_SUBVAR  = r'(?:sub|subverb|subcmd|verb|op)'

# THE SUB-DOOR VARIABLE ALSO DERIVES FROM THE MODULE ITSELF: whatever name the module binds from the first positional
# word (`const act = args.positional[0]` in rite.ts, its `if (act === "receipts")` the dispatch) carries the sub-door
# there, beside the conventional names above. A name bound from any other place stays an internal parameter, so
# nexus.ts's `action === "admit"` still names no door.
def _subvar(body: str) -> str:
    bound = set(re.findall(r'\b(?:const|let)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:[A-Za-z_][A-Za-z0-9_]*\.)*positional\[0\]', body))
    return _SUBVAR if not bound else rf'(?:{_SUBVAR[3:-1]}|\b(?:{"|".join(sorted(map(re.escape, bound)))})\b)'

def dispatches(body: str, sub: str) -> bool:
    s = re.escape(sub)
    return bool(re.search(rf'case\s+["\'`]{s}["\'`]\s*:', body)
                or re.search(rf'(?m)^\s*["\'`]?{s}["\'`]?\s*:\s*{_HANDLER}', body)
                or re.search(rf'{_subvar(body)}\s*[=!]==?\s*["\'`]{s}["\'`]', body))

def dispatch_keys(body: str) -> set:
    """Every sub-door a module answers — the same derivation the check above runs, read forward."""
    return ({m for m in re.findall(r'case\s+["\'`]([a-z][a-z0-9_-]*)["\'`]\s*:', body)}
            | {m for m in re.findall(rf'(?m)^\s*["\'`]?([a-z][a-z0-9_-]*)["\'`]?\s*:\s*{_HANDLER}', body)}
            | {m for m in re.findall(rf'{_subvar(body)}\s*[=!]==?\s*["\'`]([a-z][a-z0-9_-]*)["\'`]', body)})

for c in cmds:
    parts = c.split()
    verb  = parts[0]
    if verb not in live:
        fail.append(f"{c!r} — no top-level verb `{verb}` answers"); continue
    if len(parts) < 2:
        continue
    sub = parts[1]
    module = CMDS_DIR / f"{verb}.ts"
    if not module.exists():
        continue                      # the door dispatches elsewhere; the top verb already answered
    subs_checked += 1
    if not dispatches(module.read_text(), sub):
        fail.append(f"{c!r} — `{sub}` names no dispatch branch in commands/{verb}.ts")

# ── AND EVERY CODE SYMBOL THE RITE CITES MUST EXIST ─────────────────────────────────────────────
# The rite explains itself by pointing at functions — `provisionThresholdRecoveryAtFounding`,
# `assertSealReady`, `personaSlotCeiling`. A citation that names nothing is worse than none: it sends a
# reader to a symbol they cannot find, on a night when the reader is deciding whether to trust the step.
# One was already stale — the founding chain cited `charterKeySetHash`, and the code calls
# `sealKeySetHash`.
# THE STACK A RITE CITES IS WIDER THAN ITS TYPESCRIPT. The tending rite explains itself by pointing
# at the python that holds the palaces — `EmbedderIdentityUnknownWarning` lives in the mempalace
# backend — so a scan of `packages/**/src/*.ts` alone reports a standing symbol as a ghost and sends
# a reader chasing a citation that was true all along.
blob = "".join(q.read_text(errors="replace") for q in pathlib.Path("packages").rglob("*.ts")
               if "/dist/" not in str(q) and "/src/" in str(q))
blob += "".join(q.read_text(errors="replace") for q in pathlib.Path("packages").rglob("*.py")
                if "/node_modules/" not in str(q))
# A GONE SUBMODULE READS AS UNREAD, NEVER AS A GHOST. `mempalace/` stands as a submodule; a checkout without
# it (a fresh worktree) holds none of the python half, and a symbol that lives there would read "defined
# nowhere" — a true citation named as a stale one. Such a checkout names the absent root and calls no symbol
# a ghost that the scanned half does not settle. A CI runner checks submodules out, so absence there reads as
# the checkout's own fault.
unscanned = []
for _root in ("mempalace/mempalace", "mempalace/tests"):
    _p = pathlib.Path(_root)
    if _p.exists():
        blob += "".join(q.read_text(errors="replace") for q in _p.rglob("*.py"))
    else:
        unscanned.append(_root)
if unscanned and os.environ.get("GITHUB_ACTIONS") == "true":
    fail.append(f"{', '.join(unscanned)} — absent on a runner that checks submodules out; the python half went unscanned")
cited = sorted({m for m in re.findall(r'`([a-zA-Z_][a-zA-Z0-9_]*(?:#[a-zA-Z][a-zA-Z0-9_]*)?)`', rite)
                if re.search(r'[a-z][A-Z]|#', m)})
ghosts = [c for c in cited if c.split("#")[-1] not in blob]
for g in ghosts:
    if unscanned:
        print(f"[rite-commands] UNREAD `{g}` — found in no scanned source, and {', '.join(unscanned)} "
              "stands absent from this checkout (the submodule went unscanned)")
    else:
        fail.append(f"`{g}` — cited by the rite, defined nowhere in source")

# ── THE SURFACE READS AT THE VERB, NEVER AT THE DOOR ────────────────────────────────────────────
# A door count reports a collapse an operator cannot feel: the fan-out lives one level below the
# number, so a surface halved by doors may not have moved at all. Both figures ride together — either
# alone flatters — and both DERIVE, so neither can go stale in a file somebody has to remember.
doors_json = subprocess.run(["node", BIN, "help", "--json"], capture_output=True, text=True)
doors = json.loads(doors_json.stdout)["data"]["entries"] if doors_json.returncode == 0 else []
addressable = 0
for d in doors:
    module = CMDS_DIR / f"{d['name']}.ts"
    addressable += 1 + (len(dispatch_keys(module.read_text())) if module.exists() else 0)

print(f"[rite-commands] {len(cmds)} commands instructed, {subs_checked} sub-doors checked, "
      f"{len(cited)} symbols cited")
print(f"[rite-commands] the surface: {len(doors)} doors · {addressable} addressable verbs")
if fail:
    for f in fail: print(f"    {f}")
    print("  The rite is the operator-instruction source — fix the RITE, or restore the door.")
    sys.exit(1)
print("  every instructed command resolves to a door that answers, and every cited symbol "
      + ("the scan reached exists" if unscanned else "exists"))
PY
