#!/usr/bin/env node
/**
 * `lares` — operator CLI entry point.
 *
 * Dispatches subcommands. Adding a new command means: add a handler under
 * src/commands/, add a row to COMMANDS below, and (if the command needs help
 * text) add a description.
 *
 * Architecture notes:
 *   - The CLI dispatches and nothing more. Every command's logic lives in a
 *     library function (typically in @lararium/node), so the same operations
 *     can also run from inside the TW5 vm via the verb-tiddler protocol.
 *   - No HTTP/RPC surface here. CLI ↔ live-node coordination rides a
 *     capability-bearing verb-summons over the daemon's Unix socket, whose
 *     outcome lands as a durable CRDT receipt — web2-free.
 *   - One surface, two actors (operator-peer #actor-parity): the same commands
 *     serve a HUMAN at a TTY and an AI AGENT acting programmatically. Output
 *     renders by audience — prose on a TTY, a deterministic structured payload
 *     under `--json` / off-TTY (see ../render.ts). Authority rides WITH the
 *     intent (capability-bearing verb-summons), never a session or login.
 */

import { fileURLToPath } from "node:url";
import { realpathSync }  from "node:fs";
import { stdout }         from "node:process";
import { parseArgs, ArgsError, type ParsedArgs } from "../parse-args.js";
import { CustodyLocked, CustodyRowUnavailable } from "@lararium/node";
import { seatOfflineCustody, OfflineCustodyRefused } from "../offline-custody.js";
import { cmdHerm }                    from "../commands/herm.js";
import { cmdHost }                    from "../commands/host-cmd.js";
import { cmdWalk }                    from "../commands/walk-cmd.js";
import { cmdDraft }                   from "../commands/draft.js";
import { cmdMeme }                    from "../commands/meme.js";
import { cmdBag }                     from "../commands/bag.js";
import { cmdWiki }                    from "../commands/wiki.js";
import { cmdAct }                     from "../commands/act.js";
import { cmdReceipt, cmdCancel }      from "../commands/receipt-cmd.js";
import { cmdIngest }                  from "../commands/ingest.js";
import { cmdWatch }                   from "../commands/watch.js";
import { cmdShore }                   from "../commands/shore.js";
import { cmdWingOf }                  from "../commands/wing-of.js";
import { cmdSense }                   from "../commands/sense.js";
import { cmdFlowRun }                 from "../commands/flow-run.js";
import { cmdMempalace, MEMPALACE_OWN_VERBS } from "../commands/mempalace.js";
import { cmdHooks }                   from "../commands/hooks.js";
import { cmdSensorium }               from "../commands/sensorium.js";
import { cmdCleanupDays }             from "../commands/cleanup-days.js";
import { renderCommandHelp, helpDoor } from "../command-help.js";
import { emit, exitFor } from "../render.js";
import { storeFailure } from "../store-door.js";
import { reachHelpMeme }              from "../help-meme.js";
import { cmdTestQuine } from "../commands/scripted.js";
import { cmdFleet }                   from "../commands/fleet.js";
import { cmdHandle }                   from "../commands/handle.js";
import { cmdVault }                    from "../commands/vault.js";
import { cmdPersona }                  from "../commands/persona.js";
import { cmdLibrary }                  from "../commands/library.js";
import { cmdCabal }                    from "../commands/cabal.js";
import { cmdEdge }                     from "../commands/edge.js";
import { cmdRaise }                    from "../commands/raise.js";
import { cmdCircle }                   from "../commands/circle.js";
import { cmdNexus }                    from "../commands/nexus.js";
import { cmdVessel }                   from "../commands/vessel.js";
import { freshBuildGate, needsFreshBuild } from "../build-freshness.js";
import { VERB_SURFACE, projectOntoSurface } from "@lararium/tw5";

type Handler = (args: ParsedArgs) => Promise<number>;

export interface Command {
  readonly name:        string;
  readonly summary:     string;
  readonly handler:     Handler;
  /**
   * Every option and flag NAME a handler beneath this command reads (global ones — see GLOBAL_FLAGS — stand
   * once, outside every row). The dispatcher refuses any other name BEFORE the handler runs: a flag nobody
   * reads used to vanish, and the act ran without it. `tests/accepts-table.test.ts` walks the handlers'
   * source and reds when one reads a name this row omits, so the row cannot drift from the code.
   */
  readonly accepts:     readonly string[];
  /**
   * A verb of this command that hands the line to a program with its own grammar (`mempalace <verb>`
   * passes through to the vendored CLI). The vendored parser refuses its own unknowns, so the gate stands
   * aside for exactly the verbs this names.
   */
  readonly passesThrough?: (args: ParsedArgs) => boolean;
  /**
   * Which projections MAY expose this command — named from the SHARED `VERB_SURFACE` vocabulary the daemon
   * verb-plane also reads, so the two tables can never drift apart on what a surface is CALLED.
   *
   * The tables stay separate on purpose: a CLI command runs in-process at a terminal, a daemon verb routes
   * through the VM into a vessel, and collapsing them would conflate two planes. Only the VOCABULARY unifies.
   *
   * Absent → `[VERB_SURFACE.cli]`, and that default carries a rule rather than a convenience: nothing
   * reaches an AGENT surface until a hand declares it. Growing the agent face stays a deliberate act per verb.
   */
  readonly surfaces?:   readonly string[];
  /**
   * TRUE when running this command HOLDS A KEY — it mints, signs, seals, or stakes. Carries the SAME
   * meaning as `VerbSpec.signs` on the daemon plane, deliberately worded once and referenced here.
   *
   * An agent surface may render such a command and compose its arguments; it MUST NEVER execute one. The
   * signing hand stays the human's, which is why `lares surface --executable` drops these even from a
   * surface that declared them.
   */
  readonly signs?:      boolean;
}

/**
 * Names every command reads: `--json`/`--no-json` (render.ts), `--help`/`--meme` (the dispatcher), `--yes`
 * (the confirmation gate), `--skip-build`, which `freshBuildGate` appends when it re-execs the line, and
 * `--keyhive-trace`, which asks for Keyhive's own tracing by name ({@link askKeyhiveTrace}).
 */
export const GLOBAL_FLAGS: readonly string[] = ["json", "help", "meme", "yes", "skip-build", "keyhive-trace"];

/**
 * The environment name that asks for Keyhive's trace (`@lararium/keyhive`, `KEYHIVE_TRACE_ENV`; the CLI
 * holds no dependency on that package, so `tests/keyhive-trace-flag.test.ts` welds the two spellings).
 */
export const KEYHIVE_TRACE_ENV = "LAR_KEYHIVE_TRACE";

/**
 * KEYHIVE'S TRACE STAYS OFF UNLESS A PERSON ASKS BY NAME. Keyhive's tracing prints every step of its own
 * work (document ids, digests) and buries the answer a person asked for, so no process turns it on by
 * default. `--keyhive-trace` asks: it sets the toggle in THIS process's environment before any command
 * runs, so an act in this process traces, and a vessel this command stands inherits the ask. The
 * environment toggle alone asks the same, for a daemon a person starts another way.
 */
export function askKeyhiveTrace(flags: Readonly<Record<string, unknown>>, env: Record<string, string | undefined> = process.env): boolean {
  if (flags["keyhive-trace"] !== true) return false;
  env[KEYHIVE_TRACE_ENV] = "1";
  return true;
}

/** Edit distance, for naming the nearest accepted spelling of a refused flag. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] as number;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j] as number;
      row[j] = Math.min(cur + 1, (row[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length] as number;
}

/**
 * The flag names on the line that this command reads nowhere, each with its nearest accepted spelling (or
 * null when nothing sits close). Empty when every name is read, or when the command passes this line on.
 */
export function unknownFlags(cmd: Command, args: ParsedArgs): { name: string; nearest: string | null }[] {
  if (cmd.passesThrough?.(args) === true) return [];
  const known = [...new Set([...cmd.accepts, ...GLOBAL_FLAGS])];
  const names = [...new Set([...Object.keys(args.options), ...Object.keys(args.flags)])];
  return names.filter((n) => !known.includes(n)).map((name) => {
    const best = known.map((k) => ({ k, d: distance(name, k) })).sort((x, y) => x.d - y.d)[0];
    return { name, nearest: best !== undefined && best.d <= Math.max(2, Math.floor(name.length / 3)) ? best.k : null };
  });
}

/** What a projection hands back — the shape any surface renders from. */
export interface SurfaceEntry {
  readonly name:      string;
  readonly summary:   string;
  readonly signs:     boolean;
}

/**
 * PROJECT the command table onto one surface.
 *
 * One table, many faces. A surface that kept its own catalogue would drift from the plane it claims to
 * expose, and that drift never announces itself — it shows up as a verb an agent can reach and a human
 * cannot, or the reverse. So the declaration lives beside the handler, once.
 */
export function projectCommands(surface: string, executableOnly = false): readonly SurfaceEntry[] {
  return projectOntoSurface(COMMANDS, (c) => c, surface, executableOnly)
    .map((c) => ({ name: c.name, summary: c.summary, signs: c.signs === true }));
}

export const COMMANDS: readonly Command[] = [
  { name: "vessel",        summary: "THE VESSEL DOOR \u2014 one namespace over the vessel's own causal island (store, genesis artifact, daemon, corpus). Four primitives and one read: `found` mints identity + bootstrap (`--hearth --name <label>`: the Stable founding act, a hearth with persona zero and its one-seat seed charter; `--hearth --restore <bundle>`: the same act with a restored face as persona zero; bare: a place with no face, which joins a face by `lares fleet join`) \u00b7 `stand` brings the daemon up and reports ([--foreground] [--with-web] [--restart]) \u00b7 `stop` halts it on the port \u00b7 `seed` plants every bags/* holding back into its doc \u00b7 `read` inspects and starts nothing. Compositions ride `vessel rite <petname>` \u2014 founding \u00b7 refresh \u00b7 rebuild, so a new cap-stack arrives as a rite, never as another top-level verb. A fresh founding composes: found \u00b7 stand \u00b7 seed. Advancing the genesis composition is a MESH act \u2014 `nexus kahuli` \u2014 never a vessel door.", handler: cmdVessel, accepts: ["apply", "bag", "chair", "change-id", "claude", "codex", "copilot", "cut", "dry-run", "force", "foreground", "genesis", "hearth", "in-wiki", "init", "install", "name", "observe", "palaces", "port", "restart", "restore", "root", "shadow", "storage", "tag-blobs", "vscode", "wiki", "with-web"], signs: true /* found mints the vessel key + persona root; seed writes founding material */ },
  { name: "herm",          summary: "Stand a HERM (Lares Viales) — the wiki-less wayfarer that STANDS the carriage crossroads (Socket B) a family's hearths dial to carry sealed cad bodies between each other. Pi-deployable: `--port` = the http FLOW-map read-face; `--relay-port` (LAR_HERM_RELAY_PORT, default 8090) = the crossroads WS port; `--relay-seed <hex>` (LAR_HERM_RELAY_SEED) pins the gate seed, else it derives from this Herm's OWN identity (stable across restarts — hearths keep dialing the same key, NEVER a fresh random). Spawns the SAME node boot as `lares vessel stand`, routed to the wiki-less recipe; prints the dial URL(s) + gate pubkey to hand a hearth.", handler: cmdHerm, accepts: ["port", "relay-port", "relay-seed"] },
  { name: "host",          summary: "THE HEARTH'S HOSTING DOOR — a hearth hosts walkers in a Nexus it carries. `lares host` reads what it hosts: per Nexus, the live epochs (each the CID of a signed hosting act), the cap, and how many invites were redeemed (counts, never rows). `host roll [--nexus <aid>] [--cap <n>]` signs the next hosting act with the per-Nexus leaf of the face this vessel wears (none worn: it refuses) and lands it on this hearth's hosting doc in the Nexus; grants and tokens live for the current and previous epoch, so rolling twice is the hard roll. `host invite [--nexus <aid>] [--relay <ws-url>]` mints this hearth's own invite at the current epoch and prints the one `lar-invite:` string to carry — it redeems once, at this hearth's own gate, and nothing about it is kept. While the vessel stands, each door runs inside it.", handler: cmdHost, accepts: ["cap", "nexus", "relay"], signs: true },
  { name: "walk",          summary: "THIS VESSEL'S WALKING DOOR — a vessel walks in at another hearth on an invite, as the face it wears. `lares walk` reads where it walks: per hearth, the Nexus, whether its invite still waits to settle, the grant it holds, and how many invites its wallet holds. `walk take <lar-invite:…>` keeps a carried invite durably, and the vessel's hearth dial walks in on it; a vessel walks at one hearth, so a take for a second refuses and writes nothing. `walk invite` hands the newest invite out of the wallet as one string to carry. A node carries none of its documents at a hearth — it is its own durable store. While the vessel stands, each door runs inside it.", handler: cmdWalk, accepts: [] },
  { name: "act",           summary: "Residency Model ACTION verb (ADD/COPY/MOVE/CLEAR/DROP/LOAD/CREATE) + `REPACK --source <bundle> --from <bag>`, the collect-the-residency export: the island re-renders a multi-tiddler bundle from its aside provenance through TW5's own serializer. Run `lares act` for usage.", handler: cmdAct, accepts: ["bag", "change-id", "dry-run", "from", "in-wiki", "out", "plane", "shadow", "source", "source-uri", "title", "to"] },
  { name: "ingest",        summary: "Disk→records through the Confluence gate: scan + diff (preview) or --apply through the island's INGEST verb. --tag-blobs stamps the CAS opt-in flag (`.meta` sidecar / meme ahu meta) for the large un-flagged carriers that would fault during LOAD/INGEST (preview names the count).", handler: cmdIngest, accepts: ["apply", "change-id", "in-wiki", "source", "tag-blobs", "to"] },
  { name: "watch",         summary: "Watch a source dir and fire the ingest gesture per settle — one wave per quiet window. Preview by default; --apply submits. A vanished file tombstones nothing: the watcher hands it to the vessel's shore, where it stands pending until a person answers (`lares shore`).", handler: cmdWatch, accepts: ["apply", "debounce", "source", "to"] },
  { name: "shore",         summary: "A person's answers at the disk shore. `lares shore` looks at the disk and lists what stands for a hand: each standoff (the disk and the records say different things, and nothing writes) with its key, and each pending removal (a file vanished where a base stands; nothing writes back and nothing tombstones). `shore take-records <uri> --key <key>` writes the records' render over one standoff's file; `shore take-disk <uri> --key <key>` lands that file's words in the records. `shore restore <uri>` writes a vanished file back; `shore remove <uri>` deletes the carrier in the wiki. Over more than one carrier, name the count that stands pending (`--all --count <n>`). An answer naming a state that moved takes nothing.", handler: cmdShore, accepts: ["all", "bag", "count", "key", "yes"] },
  { name: "draft",         summary: "Pull a tiddler from a lower bag into a writable draft (no tombstone). The operator may later land it through a residency ACTION verb (`lares act`).", handler: cmdDraft, accepts: ["to"] },
  { name: "receipt",       summary: "`lares receipt <requestId>` — read a verb request's receipt WITHOUT dispatching anything (H1/M14): the one door `outcome-unknown` / `request-abandoned` tell an operator to check. Answers from the vessel's own ledger + durable outcome doc; never runs a second attempt.", handler: cmdReceipt, accepts: [] },
  { name: "cancel",        summary: "`lares cancel <requestId>` — withdraw a request BEFORE it is read (M8/M14): the operator's OWN explicit withdrawal, marking the id abandoned so a later line under the same id refuses rather than running. Never sent on a bare timeout by any automated path (council ruling 4).", handler: cmdCancel, accepts: [] },
  { name: "meme",          summary: "THE MEME DOOR — one family for every law over meme text; a verb DECLARES ITS SEAT: `normalize` · `check` · `project --to md` run local over a file with no daemon, `put` · `get` · `project` to a rendered target ride the daemon verb. Store-backed verbs require `(--recipe <slug> | --bag <slug>)`. `put <uri> (--recipe <slug> | --bag <slug>) [--base <hash>] [--file <path>]` lands a framed meme through the Confluence gate (the same `placeMeme` the HTTP route and the MCP tool call): `--recipe` edits AS the named wiki; `--bag` places into that bag and refuses when this island cannot write it; `--base` carries the canonical hash last read — records that moved past it CONFLICT and nothing lands. `get <uri> (--recipe <slug> | --bag <slug>)` reads the meme back (text on stdout, the base on stderr). `normalize <file…>` canonicalizes a carrier's framing and re-stamps its block check; `check <file…> [--gradient | --edges]` reads the same law and writes nothing (drift exits 1). `project <file|uri> --to <mem|md|html|tid|json> [--out <path>]` renders a meme — `--to md` over a file writes the submission pair <name>.md + <name>.md.meta, deterministic and clock-free. Slugs ride bare. Bare `lares meme` prints usage.", handler: cmdMeme, accepts: ["bag", "base", "check", "dest-bag", "dialect", "edges", "file", "from-bag", "gradient", "grammar", "if-match", "out", "realm", "recipe", "root", "sitting", "to", "tongue", "tree"] },
  { name: "bag",           summary: "Operate on individual bags: pin / unpin / stats / register-cold. Run `lares bag help`.",      handler: cmdBag, accepts: ["all", "approve", "dir", "dry-run", "fetch", "held", "holder", "home", "pin", "reason", "release", "repo", "role", "root", "sweep", "tier", "to", "vcs"] },
  { name: "wiki",          summary: "Operate on whole wikis: init/open/sync/pin/unpin/add-bag/remove-bag/list/which. Run `lares wiki help`.", handler: cmdWiki, accepts: ["days"] },
  { name: "cleanup-days",  summary: "Read or set Claude Code's `cleanupPeriodDays` in ~/.claude/settings.json — how many days a session file survives before Claude deletes it at startup. Those files carry the mempalace's verbatim harvest source, so a short window evaporates raw memory before it's mined. `lares cleanup-days` shows the current value; `lares cleanup-days <N>` (or `max`) sets it. Claude rejects 0; the floor 99999 (~274 yrs) names the keep-forever idiom. Any wiring RAISES a value below the floor — memory recovers from those files, so retention is the one setting this house does not leave short. This command reads it, or sets any value the operator wants.", handler: cmdCleanupDays, accepts: [] },
  { name: "sense",         summary: "THE SOVEREIGN SENSORIUM'S ONE DOOR (the guest comparator lives at `lares mempalace`). Addressed: `lares sense <sensorium> <verb>` targets any sensorium by name; bare `lares sense <verb>` keeps the `memory` default. READ — four verbs, the PLANE as a parameter: `search` (hybrid recall) · `relate` (bitemporal KG) · `structure` (entity-pair hallways) · `status` (wings/rooms/entities/total); `--lens <content|structure|form|persistence>` picks the plane (default content). One verb reaches any plane; a new plane needs no new verb. STAND — `setup` (the sovereign organs; it left the boot, so standing them takes its own act). FEED — `capture` (one native source, the hook's own verb) · `pour` (one pointer's bearing gradient; `pour --all` walks the whole tending movement: quiesce, baseline, drawers, bearing, projection, verify, resume) · `sweep` (the bulk drawers leg alone) · `refresh` (re-derive the projection alone) · `meta` (tune the annotators) · `recall` (stamp-filtered verbatim drawers). HOLDERS — `quiesce` · `resume` · `holders` (the topology) · `teardown` (clean tear for a re-pave). DURABLE LIFECYCLE, direct over manifest.json — `roster` · `inspect` · `build` · `reconcile` read and re-settle; `promote` · `retire` · `un-retire` · `purge` seat HITL and need --approve. INSTRUMENTS over a poured sensorium — `rejim` (rhythm) · `analyze` (change-points) · `ki` (coupling verdict) · `li` (gluing verdict) · `jing` (the li∘ki square) · `plane-record` (ONE cid → its presence across content · structure · form, honest nulls where a plane lacks it — the cross-plane witness, read-only) · `couple-r` + `forecast` (the R plane) · `mismatch` (does the coupling read honest?). WALK — `worldline` (the spirit tree) · `telemetry` (project lar_* gradients) · `flow` (capture topology). Rides the daemon's composed caps (the single-owner law).", handler: cmdSense, accepts: ["agent", "all", "all-strata", "approve", "as-of", "channel", "confirm", "drain", "dry-run", "ephemeral", "force", "function", "grounds", "halves", "hold", "imago", "k", "keep-hooks", "lens", "limit", "list", "min-count", "names", "not-root", "pair", "palace", "project", "reason", "repour", "room", "self-weight", "sensorium-root", "session-id", "signal", "span", "speaker", "spectral", "store-swap", "surface", "wing", "writeback"] },
  { name: "flow",          summary: "THE PET-NAMED COMPOSED-FLOW SURFACE (the anti-verb-sprawl door). One verb, N flows: the low-level instruments (crystallize · phase · whiten · couple · gate · mismatch) become the building blocks a FLOW composes, never the surface. Bare `lares flow` lists the flow-set (crystal · rhythm · couple) with their cap-stacks; `lares flow <petname> --signal <ndjson> [--names a,b,c] [--target <uri>]` runs one — the daemon looks its cap-stack up and runs each step routed by hull (crystallize/couple TS · phase py · mismatch daemon), threading each outcome to the next. New capability arrives as a new flow, never another raw verb. The signal rides --signal; auto-extraction from a poured target stands OWED.", handler: cmdFlowRun, accepts: ["names", "signal", "target"] },
  { name: "wing-of",       summary: "Resolve a transcript's per-project WING through the one TS wing law (recorded cwd → wing slug) — the resolver the ingest hook calls first; prints the bare slug on the prose path. `lares wing-of <transcript.jsonl>`. No recorded cwd → not-found (the caller's fallback ladder decides).", handler: cmdWingOf, accepts: [] },
  { name: "mempalace",     summary: "THE GUEST COMPARATOR'S DOOR (the sovereign sensorium lives at `lares sense`). `setup` raises the guest ~/.mempalace; `harvest` mines vanilla transcript drawers into it only — no lar_* stamps, no live capture, the clean comparator; `repave` previews or rebuilds it; `status` / `quiesce` / `resume` observe and control live holders and hooks.", handler: cmdMempalace, passesThrough: (a) => a.positional[0] !== undefined && !MEMPALACE_OWN_VERBS.includes(a.positional[0]), accepts: ["confirm", "dry-run", "help-mempalace", "hold", "keep-hooks", "project", "wing"] },
  { name: "hooks",         summary: "The hook-lever: `pause` / `resume` / `status` the capture + ingest hooks (a marker file the hook scripts no-op on when paused). Lets a migration/teardown run WITHOUT daemon-spawn contention. `lares mempalace quiesce` pauses AND drains; this carries the lever alone.", handler: cmdHooks, accepts: ["reason"] },
  { name: "sensorium",     summary: "The source-neutral sensorium surface: `run` / `open` ingest a path into an ephemeral sensorium; `query` / `ls` / `keep` / `dissolve` tend its lifecycle; `name`, `propose-name`, `names`, and `accept-name` attach or review local labels over a discovered cap-stack. Run `lares sensorium help`.", handler: cmdSensorium, accepts: ["all", "evidence", "keep", "name", "orphans", "projection"] },
  { name: "test-quine",    summary: "Verify the quine round-trip: genesis → boot → render → hash.",                  handler: cmdTestQuine, accepts: [] },
  { name: "vault",         summary: "The VESSEL KEY custody door. The vessel key seals the vessel's private rows (the keyhive and veil archives among them), and every boot rests at the floor until a person unlocks it: `unlock` opens the key on a TTY credential \u00b7 `lock` drops it \u00b7 `bind [--passphrase|--paper]` adds a slot \u00b7 `unbind <slot-id> [--rotate]` removes one, and with --rotate moves the key itself in the same act \u00b7 `status` shows the slot tree, one reading of each standing file, and any private file outside the carrier table. `backup --face <N> --out <file>` cuts ONE face's backup bundle through the standing vessel, sealed under a new route of its own: the face's root, its own lines and the content keys this vessel holds for it, and no veil key or seat. `restore <file> [--as <N>]` brings a face back from its bundle as a recovery act: this vessel derives its own veil and takes a NEW seat under the face's fixed prefix; `restore <file> --memory` lands the bundle's content keys on that seat. A credential rides a TTY alone: no flag, environment variable or pipe carries one.", handler: cmdVault, accepts: ["as", "cards", "face", "memory", "out", "paper", "passphrase", "rotate"], signs: true /* holds and rotates persona key material */ },
  { name: "library",       summary: "The ACQUIRED shelf — books and corpora a human did not author, kept READABLE and VERIFIABLE outside every tracked tree. `bags/` carries what an operator authors and round-trips; an acquired body has no author here and no parse∘render fixed point, so left on the seed surface it enters git history and a growing shelf grows the history with it. The tier stands in the SHRINE at `<lararium>/library` — `~/.local/share/lararium/library`, or LAR_LIBRARY — a separate house from the runtime vessel store, so acquired bytes never depend on runtime records. Layout: `<collection>/<cid>/<the real filename>` — the directory name IS the digest (audit with sha256sum, no tooling), the filename reads to a human; no per-entry sidecar — each entry's record rides as its own `#/<cid>` ahu slot inside the collection's `index.mem` carrier, carrying origin + licence + the RFC-6920 anchor. `list` · `show <coll>` · `acquire <file> --to <coll>` (MOVES by default — moving carries the point; --keep copies) · `verify` (re-digests BYTES, never records) · `index <coll> --out <path>` (the tracked part that travels) · `path <coll>`. A reference NAMES: `library:mark-twain` travels, a directory does not.", handler: cmdLibrary, accepts: ["keep", "licence", "license", "note", "origin", "out", "to"] },
  { name: "persona",       summary: "The PLURALITY-PONO identity multitude. `new <index> --name '<petname>'` mints/loads a persona root; `--handle '<Handle>'` independently declares its outward name; `--seat [--chair <label>]` stands it for a Kahu chair on THIS node, needs no Handle and carries a private chair label; `--split-root` opts into the 2-of-3 recovery split. `wear <index>` switches the active persona; `list` prints held indices, labels, Handles and local chair labels; `sync` carries labels and Handles to the operator's own fleet while seat claims stay local; `reissue [--nexus <aid>]` hands the worn face's key at one Nexus on to a fresh random key by a hand-over both keys sign, which the Nexus's gates read beside the face's admit. `guardian show <index>` prints a face's prefix and its set; `guardian offer --prefix <persona-…>` mints a guardian's fresh key for one face and prints its card and offer line; `guardian enrol <index> --threshold <k> <offer>…` enrols the face's first guardian set by one typed event its own key signs, refusing a key another face holds. `provisional <index>` reads whether a restored face still waits on a party's view; `confirm <index> <lar-log-view:…>` confirms it by one party's own view; `view <persona-…> --seat-key <key>` signs a chair's view of a face's head; `guardian view --prefix <persona-…>` signs a guardian's own view with its card.", handler: cmdPersona, accepts: ["chair", "handle", "name", "nexus", "prefix", "seat", "seat-key", "split-root", "threshold"], signs: true /* mints persona roots */ },
  { name: "circle",        summary: "The FOLLOW VERB — the INVERSION-OF-CONTROL social graph. `add <nym> --to <circle> [--petname <label>] [--card <file>]` recognises a nym (already-known, or TOFU-admits a carried self-certifying HandleCard) + optionally sets its PRIVATE local label + adds it to the circle (adding to a circle IS the follow); `remove <nym> --to <circle>` unfollows; `list [--to <circle>]` reads the private follow-view (petname + last-seen glamour). The graph stays PRIVATE and LOCAL — nothing reaches the crossroads plane, no central trace. Publishing a public glamour stays a separate, deliberate act. Fail-closed: following an unmet nym needs `--card`.", handler: cmdCircle, accepts: ["card", "petname", "to"] },
  { name: "cabal",         summary: "The JOIN AXIS — a mutual-hold relation with a cabal-realm, orthogonal to the CARRIAGE contract `nexus contract` writes. `cabal vouch <joiner-nym> --realm <realm-doc-id>` stakes the WORN face's OWN standing on one joiner, signed with the key that face presents at the Nexus the realm stands under, onto the realm's own vouch board — no kahu quorum, because a vouch stakes one hand's own standing rather than performing a steward act. It ADMITS NOBODY: a vouch rides as signal-2 on the lineage the admission price walks, and the cost lands at the moment of vouching, since a voucher's score SPLITS across everyone they vouch for. Re-vouching the same joiner stays ONE edge — re-minting never buys out-degree.", handler: cmdCabal, accepts: ["applicant", "cap", "nexus", "realm"], signs: true /* a vouch STAKES the voucher's own standing */ },
  { name: "edge",          summary: "Set one RELATIONSHIP aside, or take the marker back down \u2014 the k\u0101pae raised over an EDGE rather than over a party. `edge kapae` shadows a relation and `edge un-kapae` re-admits it as a deliberate signed act; name the relation by `<edge-id>`, by `--member <key> --realm <id>`, or by `--device <key>`. Two hands act: the HOLDER the edge names (a voucher over a vouch, a fleet root over a device) and, with `--quorum`, the seat quorum of the charter the realm stands under. A lower lifts only its own hand's raises, and a raise wins a tie, so a removal never quietly reverses when a partition heals. The write asserts no authority: whether a hand holds the edge gets decided by whichever reader consults the shadow. `edge settle` answers each counted raise on the key side: the seat a raise names leaves the face's key group. With `--quorum --partial` a vessel that holds fewer seats than an act takes signs its part and prints a partial, and `edge cosign` adds another vessel's seats and lands the act once it counts.", handler: cmdEdge, accepts: ["as", "realm", "nexus", "member", "device", "quorum", "fleet", "partial", "voucher", "joiner", "from", "act"], signs: true /* a kapae act signs over a relationship */ },
  { name: "raise",         summary: "The RECOGNISER's half of the raise ceremony. A vessel standing at the WAKING FLOOR emits a challenge; `raise sign <challenge-json> [--as <index>]` signs it with one of YOUR persona roots and hands back a grant. The caps that arrive at that vessel ride YOUR key \u2014 no key of yours ever rests on the vessel you raise, and the grant stands only until that Nexus's lease epoch rolls past it.", handler: cmdRaise, accepts: ["as"], signs: true /* signs with a persona root */ },
  { name: "nexus",         summary: "The Nexus founding-kahu ROSTER + its PRE-ROTATED charter-epoch chain (TUF≈KERI) — the Kapae immune antigen's authority home. `nexus seal seat` gives each persona that STANDS for a chair a seat key of its own (minted sealed on this vessel, apart from every persona root) + establishes the genesis epoch, which commits one digest per chair to that chair's NEXT key, printed once on a cold-key card the operator reads back; `nexus seal rotate` takes each chair's card back on a terminal + advances the chain (FAIL-CLOSED on a roll the law refuses); `nexus seal show` reads the roster, chain head, + quorum verdict; `nexus seal roll open|join|sign|file` rolls a joint Nexus across its vaults as one carried circle; `nexus seal cofound open|join|seal` founds a FRESH two-of-two Nexus with a second operator, files carried between the two vaults, each person typing the other seat's fingerprint as heard (neither household seed moves). `nexus kapae <nym> [--reason]` RAISES a quorum-signed ban onto the always-carried antigen board (a banned presenter draws Mu); `nexus kapae --list` folds the currently-Kapae'd set; `nexus un_kapae <nym>` mints a quorum-signed lift at a strictly higher version (FAIL-CLOSED: a sub-quorum or unseated charter REFUSES, writing nothing). `nexus contract <leaf> --sig <hex>` admits a joining operator's per-Nexus leaf and emits the carried admit BUNDLE (public bytes: the admit, its lineage, the Nexus, this hearth's gate bundle pin); where the Nexus's seats rest in two vaults, `nexus contract <leaf> --nexus <aid> --out <file>` signs with the seats held here and writes a PARTIAL, and the other vault's `nexus contract --from <partial>` judges it against its own head and board, cosigns and lands it; the joinee's `nexus admit-take <file>` verifies it offline against the charter she holds, keeps it, and her dial presents it at that hearth alone.", handler: cmdNexus, accepts: ["added", "apply", "carrier", "carry", "charter", "charter-law", "cold-key", "contract", "cosign", "edge", "expiry", "face", "from", "heard", "heard-threshold", "index", "join", "list", "nexus", "note", "out", "realm", "reason", "release", "sig", "source", "steward", "threshold", "tier", "with"], signs: true /* quorum-signs admits, kapae and charter acts */ },
  { name: "fleet",         summary: "THE FLEET-JOIN DOOR — one face's fleet takes a new vessel of the same human, by three files carried by hand. `fleet join offer [--face N]` on the root holder (`--face` names which face, default 0); `fleet join request <offer>` on the joining place (its face-scoped keys mint there); `fleet join answer <request>` on the root holder (the device edge, a certificate and a grant per scope, the signed gate pin and canon, the face's sealed address secret); `fleet join land <answer>` on the joining place; `fleet join abandon` drops a pending join.", handler: cmdFleet, accepts: ["face", "out", "sync-url"], signs: true /* signs a device edge, certificates, grants and the answer */ },
  { name: "handle",        summary: "The Handle's verb family — a persona's public \"here I am\" note, its lifecycle on the handle-KEL. `publish \"<glamour>\" [--persona <index>]` (LIVE) mints a self-certifying card and announces it onto the Nexus WHO board the relay syncs; the face ANCHORS to its persona (the persona-KEL prefix owns it), so a lost presentation key recovers THROUGH the persona and a vessel with no founded persona refuses rather than self-owns. `rotate` seats a fresh presentation key under the same name, `burn` ends it terminally (self · `--from-persona`), `attest \"<claim>\"` signs a claim under the current head, and `verify-attestation <statement> [--card <file>]` runs the RECOGNISER's half — a reader-local CHAIN-verify (the chain verifies, stands unburned, seats the head that signed) that touches no network: it proves THE HANDLE SAID IT, never that the claim is TRUE, and the SURFACE-verify (asking DNS) stays a separate act. `graft` declares its shape and awaits its vessel-side pass. This is the deliberate outward act `persona --handle` only DECLARES as intent — a separate cap, never folded into persona.", handler: cmdHandle, accepts: ["card", "from-persona", "glamour", "persona", "return-locator", "subject", "surface"], signs: true /* mints + signs a HandleCard */ },
];

/**
 * Every top-level `lares` command name — the source the isomorphism fixture (cli-verbs.json) mirrors
 * and YIN's three-way parity test reads (CLI command-table ↔ MCP tool-set ↔ VERB_SEATS). Kept in sync
 * with COMMANDS by derivation, so a new verb here surfaces in the fixture the moment it regenerates.
 */
export const COMMAND_NAMES: readonly string[] = COMMANDS.map((c) => c.name);

/**
 * The global help IS the surface projection — a face reading the one table, never a second catalogue.
 *
 * `lares help --surface <name>` reads another face's projection; `--executable` drops the key-holding acts
 * an agent surface may compose and must never run; `--json` emits the shape another face consumes. Folding
 * these here rather than into a verb of their own keeps the CLI from spending a command on describing
 * commands.
 */
function printHelp(surface: string = VERB_SURFACE.cli, executableOnly = false): void {
  const shown = projectCommands(surface, executableOnly);
  console.log("lares — operator CLI for the Lares lararium stack\n");
  console.log("Usage:  lares <command> [args...]\n");
  if (surface !== VERB_SURFACE.cli || executableOnly) {
    console.log(`Surface: ${surface}${executableOnly ? " (executable — key-holding acts withheld)" : ""}`);
  }
  if (shown.length === 0) {
    console.log(`\nNo verbs project onto "${surface}" — a surface exposes what asked to be exposed.\n`);
    return;
  }
  console.log("Commands:");
  for (const c of shown) {
    console.log(`  ${c.signs ? "✍ " : "  "}${c.name.padEnd(14)} ${c.summary}`);
  }
  if (shown.some((c) => c.signs)) {
    console.log("\n  ✍ = holds a key. An agent surface may compose these and MUST NOT execute them.");
  }
  console.log(`  ${"help".padEnd(14)} Show this message.\n`);
  console.log("Global flags:");
  console.log(`  ${"--json".padEnd(14)} Emit a deterministic JSON result (ok|error + requestId) for agents/pipes.`);
  console.log(`  ${"--no-json".padEnd(14)} Force human prose even when stdout is not a TTY.`);
  console.log(`  ${"--yes".padEnd(14)} Skip confirmation prompts (required for non-interactive/agent runs).`);
  console.log(`  ${"--keyhive-trace".padEnd(14)} Print Keyhive's own DEBUG/TRACE lines (document ids, digests). Off unless asked;`);
  console.log(`  ${"".padEnd(14)} ${KEYHIVE_TRACE_ENV}=1 in the environment asks the same, for a daemon too.\n`);
  console.log("Output renders by audience: prose on a TTY, JSON off-TTY or under --json.");
  console.log("Run `lares <command> --help` for a command's own examples-first help.");
}

export async function dispatch(argv: readonly string[]): Promise<number> {
  let args: ParsedArgs;
  try { args = parseArgs(argv); }
  catch (err) {
    if (!(err instanceof ArgsError)) throw err;
    console.error(`lares: ${err.message}`);
    return 2;
  }
  // Keyhive's trace, asked by name: set before any command stands a provider or a vessel.
  askKeyhiveTrace(args.flags);
  // Global help: bare `lares`, `lares help`, or `lares --help` with no command.
  //
  // A NAME THAT DOES NOT ANSWER MUST NOT ANSWER SOFTLY. Routing an unknown command to the global menu
  // returns 0 and prints a full page, which reads exactly like a door that opened — so a caller probing
  // `lares <name> --help` cannot tell a live verb from a retired one, and the collapse's own law (no
  // spelling survives its retirement) stops being checkable from outside. The unknown-command refusal
  // below therefore owns EVERY unknown name, flags included.
  if (args.command === null || args.command === "help") {
    const surface = args.options["surface"] ?? VERB_SURFACE.cli;
    const execOnly = args.flags["executable"] === true;
    if (args.flags["json"] === true) {
      // The shape another face consumes — `signs` rides even in the executable view (where it always reads
      // false), so a reader never infers the flag's absence from a filter it did not run.
      console.log(JSON.stringify({ ok: true, data: { surface, executable: execOnly, entries: projectCommands(surface, execOnly) } }));
      return 0;
    }
    printHelp(surface, execOnly);
    return args.command === null ? 1 : 0;
  }
  const cmd = COMMANDS.find((c) => c.name === args.command);
  if (!cmd) {
    console.error(`lares: unknown command "${args.command}".  Run \`lares help\` for the list.`);
    return 2;
  }
  // Per-command help: `lares <command> --help` renders the command's own examples-first help and
  // returns — never running the handler. The command may ALSO render help on missing-args itself.
  // A SUB-DOOR answers for itself when the registry holds one (`lares vessel wire --help`), so a
  // sub-verb's flags reach the reader instead of its parent's.
  // `--meme` follows the door's help with the wiki record standing behind it, read through the meme
  // rail (`lares meme get`) — the same verb any vessel with the cap can run.
  if (args.flags["help"]) {
    const door = helpDoor(cmd.name, args.positional);
    renderCommandHelp(door, cmd.summary);
    if (args.flags["meme"] === true) return await reachHelpMeme(door, args);
    return 0;
  }
  // A flag no handler beneath this command reads is refused BY NAME, before anything runs — never after the
  // act, which would report a refusal for work already done.
  const stray = unknownFlags(cmd, args);
  if (stray.length > 0) {
    for (const { name, nearest } of stray) {
      console.error(`lares: unknown flag --${name} for \`lares ${cmd.name}\`${nearest === null ? "" : ` (did you mean --${nearest}?)`}`);
    }
    console.error(`Run \`lares ${cmd.name} --help\` for the flags it reads.`);
    return 2;
  }
  // Fresh-Build Invariant — a daemon-lifecycle verb (found/boot/mutate-identity) never runs
  // from stale dist: build the workspace, then re-exec this command in a fresh process.
  if (needsFreshBuild(args)) {
    const gate = await freshBuildGate(argv, args);
    if (gate !== null) return gate;
  }
  // THE COMMAND'S OWN KEY SESSION. A command that acts in this process seats a holder that opens at the first
  // sealed row it touches (`offline-custody`); a verb routed through a standing vessel never touches it.
  seatOfflineCustody();
  try {
    return await cmd.handler(args);
  } catch (err) {
    // A sealed row that stayed shut names itself on one line: the key was not opened, or a row does not open.
    if (err instanceof OfflineCustodyRefused || err instanceof CustodyLocked || err instanceof CustodyRowUnavailable) {
      console.error(`lares ${cmd.name}: ${err.message}`);
      return 1;
    }
    // A failure that came through the store door names itself wherever no command caught it: a refusal travels
    // as one parseable object under its own code, never as a stack trace.
    const failure = storeFailure(err, "");
    if (failure.code !== "") {
      emit(args, { ok: false, error: failure, human: () => console.error(`lares ${cmd.name}: ${failure.message}`) });
      return exitFor(failure.code);
    }
    throw err;
  }
}

// Run dispatch when this file IS the entry point (not when imported).
const invokedAsScript = (() => {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  try {
    return realpathSync(arg1) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

/**
 * Entry for the committed bin shim (bin/lares.mjs) — same path as direct invocation.
 *
 * SET THE CODE, NEVER CALL EXIT. `process.stdout` is asynchronous on a PIPE and synchronous on a
 * file, so `process.exit()` discards whatever has not drained — and `--json` exists "for
 * agents/pipes", which is exactly the sink that loses bytes. Measured: a 165,256-byte result
 * arrived whole in a file and truncated to 146,176 through a pipe, mid-string, exit code 0.
 * Setting `exitCode` lets the loop drain and exit on its own with the same status.
 *
 * A caller that must stop the process NOW still may — this only governs the ordinary return.
 */
/**
 * Let writes already queued on stdout reach a pipe before publishing the process result.
 *
 * `exitCode` preserves the stream's natural drain, but the completion callback itself can run while a
 * pipe still owns the answer. Waiting on one ordered zero-byte write makes that boundary explicit: the
 * command's verdict and its bytes leave the island together. No wall clock or retry window participates.
 */
async function drainStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stdout.write("", (error?: Error | null) => error ? reject(error) : resolve());
  });
}

export function runCli(): void {
  dispatch(process.argv.slice(2)).then(
    async (code) => {
      try { await drainStdout(); }
      catch (err) { console.error(err); process.exitCode = 1; return; }
      process.exitCode = code;
    },
    (err)  => { console.error(err); process.exitCode = 1; },
  );
}

if (invokedAsScript) {
  runCli();
}
