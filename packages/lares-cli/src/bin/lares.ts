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

import { seatTtyWardGatherer } from "../ward-door.js";
import { fileURLToPath } from "node:url";
import { realpathSync }  from "node:fs";
import { stdout }         from "node:process";
import { parseArgs, ArgsError, type ParsedArgs } from "../parse-args.js";
import { CustodyLocked, CustodyRecordUnavailable, SealedActRefused } from "@lararium/node";
import { bridge, commandScope, shimHelpLines, HOUSE_ABSENT_EXIT } from "../host-bridge.js";
import { armAskBudget } from "../local-connector.js";
import { ASK_BUDGET_FLAG } from "../ask-budget.js";
import { reportStanding, takeEntryAsks } from "../standing-report.js";
import { seatOfflineCustody, OfflineCustodyRefused } from "../offline-custody.js";
import { seatNewFaceRoute } from "../face-route-prompt.js";
import { cmdHerm }                    from "../commands/herm.js";
import { cmdHost }                    from "../commands/host-cmd.js";
import { cmdWalk }                    from "../commands/walk-cmd.js";
import { cmdMeme }                    from "../commands/meme.js";
import { cmdBag }                                   from "../commands/bag.js";
import { cmdEvents }                  from "../commands/events.js";
import { cmdWiki }                                from "../commands/wiki.js";
import { cmdCall, isCallHead, CALL_VERBS as CALL_WORDS } from "../commands/call.js";
import { BURNED_FLAGS, KeywordUsage, isKeywordLine, positionalCure, readKeywords, type KeywordLine } from "../keywords.js";
import { BARE_ADDRESS, cmdBare, liveReaders } from "../commands/bare.js";
import { cmdIngest }                  from "../commands/ingest.js";
import { cmdExport }                  from "../commands/export.js";
import { cmdImport }                  from "../commands/import.js";
import { cmdShore }                                 from "../commands/shore.js";
import { cmdSurface }                 from "../commands/surface.js";
import { cmdRealm } from "../commands/realm.js";
import { cmdDdate }                   from "../commands/ddate-cmd.js";
import { cmdOracle }                  from "../commands/oracle-cmd.js";
import { cmdLaw }                     from "../commands/law.js";
import { cmdSense, sensePathAccepts, retiredSensePromote } from "../commands/sense.js";
import { cmdFlowRun }                 from "../commands/flow-run.js";
import { cmdMempalace, MEMPALACE_OWN_VERBS } from "../commands/mempalace.js";
import { cmdHooks }                   from "../commands/hooks.js";
import { cmdSpirit, SPIRIT_VERBS }    from "../commands/spirit.js";
import { cmdMcp }                     from "../commands/mcp.js";
import { cmdLei }                     from "../commands/lei.js";
import { cmdRite }                    from "../commands/rite.js";
import { cmdSensorium }               from "../commands/sensorium.js";
import { cmdHome, cmdRepo }           from "../commands/tunnel-door.js";
import type { VerbTable } from "../verb-table.js";
import { renderCommandHelp, helpDoor, helpLines } from "../command-help.js";
import { packDoor } from "@lararium/tw5/affordance-pack";
import { emit, exitFor } from "../render.js";
import { storeFailure } from "../store-door.js";
import { cmdFleet }                   from "../commands/fleet.js";
import { cmdIntent }                  from "../commands/intent.js";
import { cmdIntentRelay }             from "../commands/intent-relay.js";
import { cmdPromote } from "../commands/promote.js";
import { cmdKapae } from "../commands/kapae.js";
import { cmdKahua }                   from "../commands/kahua.js";
import { cmdHandle }                   from "../commands/handle.js";
import { cmdVault }                    from "../commands/vault.js";
import { cmdWear }                     from "../commands/wear.js";
import { cmdPersona }                  from "../commands/persona.js";
import { cmdLibrary }                  from "../commands/library.js";
import { cmdCabal }                    from "../commands/cabal.js";
import { cmdEdge }                     from "../commands/edge.js";
import { cmdCircle }                   from "../commands/circle.js";
import { cmdNexus }                    from "../commands/nexus.js";
import { cmdVessel }                   from "../commands/vessel.js";
// THE DOORS' VERB TABLES: each row below carries its door's own table as `verbs`.
import { BAG_VERBS } from "../commands/bag.js";
import { CABAL_VERBS } from "../commands/cabal.js";
import { CIRCLE_VERBS } from "../commands/circle.js";
import { EDGE_VERBS } from "../commands/edge.js";
import { FLEET_VERBS } from "../commands/fleet.js";
import { HANDLE_VERBS } from "../commands/handle.js";
import { HERM_VERBS } from "../commands/herm.js";
import { HOOKS_VERBS } from "../commands/hooks.js";
import { HOST_VERBS } from "../commands/host-cmd.js";
import { INTENT_VERBS } from "../commands/intent.js";
import { INTENT_RELAY_VERBS } from "../commands/intent-relay.js";
import { KAHUA_VERBS } from "../commands/kahua.js";
import { LAW_VERBS } from "../commands/law.js";
import { LEI_VERBS } from "../commands/lei.js";
import { LIBRARY_VERBS } from "../commands/library.js";
import { MCP_VERBS } from "../commands/mcp.js";
import { MEME_VERBS } from "../commands/meme.js";
import { NEXUS_VERBS } from "../commands/nexus.js";
import { CAST_DOOR_VERBS } from "../commands/oracle-cmd.js";
import { PERSONA_VERBS } from "../commands/persona.js";
import { KAPAE_VERBS, TRUST_VERBS } from "../commands/promote.js";
import { REALM_VERBS } from "../commands/realm.js";
import { RITE_VERBS } from "../commands/rite.js";
import { SENSE_VERBS } from "../commands/sense.js";
import { SENSORIUM_VERBS } from "../commands/sensorium.js";
import { SHORE_ACTS } from "../commands/shore.js";
import { SURFACE_VERBS } from "../commands/surface.js";
import { TUNNEL_VERBS } from "../commands/tunnel-door.js";
import { VAULT_VERBS } from "../commands/vault.js";
import { VESSEL_SUBS } from "../commands/vessel.js";
import { WALK_VERBS } from "../commands/walk-cmd.js";
import { WIKI_VERBS } from "../commands/wiki.js";
import { freshBuildGate, needsFreshBuild } from "../build-freshness.js";
import { VERB_SURFACE, projectOntoSurface } from "@lararium/tw5";

type Handler = (args: ParsedArgs) => Promise<number>;

export interface Command {
  readonly name:        string;
  /** The one-line spelling the top-level list prints (aim <= 72 chars); absent, the summary stands there. The long
   *  `summary` rides the verb's own `--help`, so no fact leaves the CLI when the list shortens. */
  readonly brief?:      string | undefined;
  readonly summary:     string;
  readonly handler:     Handler;
  /**
   * Every option and flag NAME a handler beneath this command reads (global ones — see GLOBAL_FLAGS — stand
   * once, outside every row). The dispatcher refuses any other name BEFORE the handler runs: a flag nobody
   * reads never vanishes while the act runs without it. `tests/laws/accepts-track-the-handlers.law.test.ts` walks the handlers'
   * source and reds when one reads a name this row omits, so the row cannot drift from the code.
   */
  readonly accepts:     readonly string[];
  /**
   * The sub-verbs this door answers: the table its own dispatcher reads, a tree where a sub-verb names its own (`meme offer`).
   * `null` declares the door takes arguments, never sub-verbs (`lares wear 2`): every row says which, so no door escapes. `tests/laws/harness.ts#verbTables` reads every law's
   * door tables from here.
   */
  readonly verbs:       VerbTable | null;
  /**
   * An argument that may stand BEFORE the verb, named by what it holds (`sense` takes `<sensorium>`: `lares sense memory pour
   * --all`). The dispatcher resolves it against live state; a reader of the table reads a word outside it as this argument
   * only where the next word is a verb the table answers.
   */
  readonly leads?:      string;
  /**
   * A verb of this command that hands the line to a program with its own grammar (`mempalace <verb>`
   * passes through to the vendored CLI). The vendored parser refuses its own unknowns, so the gate stands
   * aside for exactly the verbs this names.
   */
  readonly passesThrough?: (args: ParsedArgs) => boolean;
  /**
   * The names THIS line's sub-path reads, where the door's wide `accepts` row would let a sibling's flag ride a sub-verb that
   * ignores it (`persona raise-sign --face 2`, `vessel request --dry-run`). Absent, or `null` for a line it does not narrow, the
   * door's row stands. The dispatcher refuses any other name by name before the handler runs.
   */
  readonly pathAccepts?: (args: ParsedArgs) => readonly string[] | null;
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
  /**
   * Where only SOME of a signing command's sub-verbs hold a key: those sub-verbs, by name. The command still carries
   * `signs` (an agent surface drops it whole); the top-level list names these beside the row's brief so the mark never
   * vows more than the doors do. `kahua` names its hand-only rows; a law test welds them to the store door's own set.
   */
  readonly signsOnly?:  readonly string[];
}

/**
 * Names every command reads: `--json`/`--no-json` (render.ts), `--help`/`--meme` (the dispatcher: `--meme` beside `--help`; a
 * door that reads `--meme` on its own line names it in its row, and elsewhere it refuses as any unread flag does), `--yes`
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
  // `--meme` reads globally beside `--help` alone (help runs first), so past it a door's own row decides the word.
  const known = [...new Set([...(cmd.pathAccepts?.(args) ?? cmd.accepts), ...GLOBAL_FLAGS.filter((n) => n !== "meme")])];
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
  /** The door's sub-verb table, or null where the door takes arguments; another face reads the doors from here. */
  readonly verbs:     VerbTable | null;
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
    .map((c) => ({ name: c.name, summary: c.summary, signs: c.signs === true, verbs: c.verbs }));
}

/**
 * A FLIPPED DOOR'S WORDS COME FROM ITS CARRIERS. A door every affordance of which holds an affordance carrier draws its brief
 * (the top-level index line) and its account from the baked pack; the row keeps behaviour alone (handler, verbs, accepts).
 * Absent from the pack, the row prints no brief and the door's help names the re-bake that gathers it, never a second copy.
 */
function packedBrief(door: string): string | undefined {
  const brief = packDoor(door)?.brief;
  return brief ? brief : undefined;
}

/** A flipped door's long account (the row's `summary`): its baked help, one line. */
function packedAccount(door: string): string {
  return (packDoor(door)?.help ?? []).map((l) => l.trim()).filter(Boolean).join(" ");
}

export const COMMANDS: readonly Command[] = [
  { name: "intent", brief: packedBrief("intent"), summary: packedAccount("intent"), handler: cmdIntent, verbs: INTENT_VERBS, accepts: ["face", "to", "prefer", "class", "every", "args", "nonce", "prev", "void-at", "through", "executor", "detail", "deny", "agent", "prefix", "policy", "as-of", "until"], signs: true },
  { name: "trust", brief: packedBrief("trust"), summary: packedAccount("trust"), handler: cmdPromote, verbs: TRUST_VERBS, accepts: ["face", "wiki", "why", "keep", "drop"], signs: true },
  { name: "kapae", brief: packedBrief("kapae"), summary: packedAccount("kapae"), handler: cmdKapae, verbs: KAPAE_VERBS, accepts: ["face", "wiki", "why", "keep", "drop"], signs: true },
  { name: "lei", brief: packedBrief("lei"), summary: packedAccount("lei"), handler: cmdLei, verbs: LEI_VERBS, accepts: ["rite", "branch", "head", "reach", "returns", "after", "lei", "face", "all"], signs: true, signsOnly: ["kui", "unstring", "restring"] },
  { name: "rite", brief: packedBrief("rite"), summary: packedAccount("rite"), handler: cmdRite, verbs: RITE_VERBS, accepts: ["rite", "branch", "head", "tessera", "abandon", "face", "image", "workspace", "into", "accept-omissions", "staging", "if-due", "sessions", "rollback", "keeper-to", "keeper-next", "base", "supersedes"] },
  { name: "kahua", brief: packedBrief("kahua"), summary: packedAccount("kahua"), handler: cmdKahua, pathAccepts: (a) => a.positional[0] === "get" ? (a.positional[1] ? ["face", "history"] : ["face", "history", "after", "limit"]) : a.positional[0] === "list" ? null : ["face", "text", "file", "digest", "taint", "sources", "parent", "proposal", "proposals", "fields", "all", "terms", "land"], verbs: KAHUA_VERBS, accepts: ["face", "text", "file", "digest", "taint", "sources", "parent", "proposal", "proposals", "fields", "history", "after", "limit", "all", "terms", "land"], signs: true, signsOnly: ["mint", "lift", "withdraw", "carry"] },
  { name: "intent-relay", brief: packedBrief("intent-relay"), summary: packedAccount("intent-relay"), handler: cmdIntentRelay, verbs: INTENT_RELAY_VERBS, accepts: ["face", "json"], signs: true },
  { name: "vessel",        brief: packedBrief("vessel"), summary: packedAccount("vessel"), handler: cmdVessel, pathAccepts: (a) => a.positional[0] === "request" ? ["cancel"] : VESSEL_ROW.filter((n) => n !== "cancel"), verbs: VESSEL_SUBS, accepts: ["apply", "bag", "cancel", "chair", "change-id", "cold-key", "commit", "cut", "docs", "dry-run", "force", "foreground", "fresh", "genesis", "grain", "hearth", "image", "in-wiki", "init", "keep", "lag", "lift-kahua", "name", "nexus", "observe", "page", "palaces", "porch", "port", "restart", "restore", "revert", "root", "shadow", "storage", "tag-blobs", "verbose", "wiki", "with-web", "workbench"], signs: true /* found mints the vessel key + persona root; lay writes founding material */ },
  { name: "herm", brief: packedBrief("herm"), summary: packedAccount("herm"), handler: cmdHerm, verbs: HERM_VERBS, accepts: ["port", "relay-port"] },
  { name: "host",          brief: packedBrief("host"), summary: packedAccount("host"), handler: cmdHost, verbs: HOST_VERBS, accepts: ["cap", "face", "nexus", "relay"], signs: true },
  { name: "walk",          brief: packedBrief("walk"), summary: packedAccount("walk"), handler: cmdWalk, verbs: WALK_VERBS, accepts: ["face"] },
  { name: "ingest",        brief: packedBrief("ingest"), summary: packedAccount("ingest"), handler: cmdIngest, pathAccepts: (a) => a.flags["watch"] === true ? ["watch", "apply", "debounce", "source", "to"] : INGEST_ROW.filter((n) => n !== "watch" && n !== "debounce"), verbs: null, accepts: ["apply", "change-id", "debounce", "in-wiki", "source", "tag-blobs", "to", "watch"] },
  { name: "export",        brief: packedBrief("export"), summary: packedAccount("export"), handler: cmdExport, verbs: null, accepts: ["accept-omissions"] },
  { name: "import",        brief: packedBrief("import"), summary: packedAccount("import"), handler: cmdImport, verbs: null, accepts: ["apply"], signs: true /* re-lifts sign kahua acts under the face's grant */ },
  { name: "shore",         brief: packedBrief("shore"), summary: packedAccount("shore"), handler: cmdShore, verbs: SHORE_ACTS, accepts: ["all", "bag", "boot", "count", "face", "held", "key", "kind", "pending", "yes"] },
  { name: "surface",       brief: packedBrief("surface"), summary: packedAccount("surface"), handler: (args) => cmdSurface(args), verbs: SURFACE_VERBS, accepts: ["face", "launch", "message", "realm", "workspace"] },
  { name: "meme", brief: packedBrief("meme"), summary: packedAccount("meme"), handler: cmdMeme, pathAccepts: (a) => a.positional[0] === "offer" && a.positional[1] === "show" ? (a.positional[2] ? ["nexus"] : ["bag", "all", "after", "limit", "nexus"]) : null, verbs: MEME_VERBS, accepts: ["after", "all", "approval", "bag", "check", "dest-bag", "dialect", "edges", "face", "format", "from-bag", "gradient", "grammar", "limit", "nexus", "out", "over-fresher", "realm", "recipe", "root", "sitting", "target", "to", "tongue"] },
  { name: "bag",           brief: packedBrief("bag"), summary: packedAccount("bag"), handler: cmdBag, pathAccepts: (a) => a.positional[0] === "show" ? (a.positional[1] ? ["dir"] : ["dir", "after", "limit"]) : a.positional[0] === "list" ? null : null, verbs: BAG_VERBS, accepts: ["all", "after", "limit", "approve", "dir", "dry-run", "face", "fetch", "held", "holder", "home", "list", "note", "pin", "read", "read-remove", "release", "remove", "repo", "role", "root", "sweep", "tier", "to", "vcs", "write", "write-remove", "workspace"] },
  { name: "events",        brief: packedBrief("events"), summary: packedAccount("events"), handler: cmdEvents, verbs: null, accepts: ["kind", "since", "wait"] },
  { name: "realm",         brief: packedBrief("realm"), summary: packedAccount("realm"), handler: (args) => cmdRealm(args), verbs: REALM_VERBS, accepts: ["to"] },
  { name: "wiki",          brief: packedBrief("wiki"), summary: packedAccount("wiki"), handler: cmdWiki, pathAccepts: (a) => a.positional[0] === "keep" || a.positional[0] === "unkeep" || a.positional[0] === "switch" ? [] : a.positional[0] === "render" ? (a.options["output"] === "workbench" ? ["recipe", "output", "filename", "type", "template", "variables", "overwrite", "face"] : ["recipe", "text", "form", "type", "max-bytes", "after", "target", "face", "bag"]) : a.positional[0] === "status" ? ["recipe", "target", "face", "bag", "realm"] : null, verbs: WIKI_VERBS, accepts: ["after", "bag", "count", "days", "dry-run", "face", "filename", "force", "form", "list", "max-bytes", "note", "output", "overwrite", "read", "read-remove", "realm", "recipe", "remove", "target", "template", "text", "type", "variables", "write", "write-remove", "workspace"] },
  { name: "law",           brief: packedBrief("law"), summary: packedAccount("law"), handler: cmdLaw, verbs: LAW_VERBS, accepts: ["after", "all", "face", "limit"] },
  { name: "oracle",        brief: packedBrief("oracle"), summary: packedAccount("oracle"), handler: cmdOracle, verbs: CAST_DOOR_VERBS, accepts: ["asking", "bag", "by", "caster", "coins", "face", "fresh", "observe", "realm", "recipe", "seed", "uncertain"] },
  // THE CALL SHAPE (comms-ux-enacts landing 8): each verb word takes `name=value` params alone, read by one token rule and bound in
  // the VM against the carrier's live `#/takes`; no flag table and no sub-verb (an address and `lares -` answer beside them). A verb
  // one carrier skins draws its words from the pack; `get` skins two (by title, by filter), and the pack gathers both under its door.
  { name: "get", brief: packedBrief("get"), summary: packedAccount("get"), handler: cmdCall, verbs: null, accepts: [] },
  { name: "put", brief: packedBrief("put"), summary: packedAccount("put"), handler: cmdCall, verbs: null, accepts: [] },
  { name: "delete", brief: packedBrief("delete"), summary: packedAccount("delete"), handler: cmdCall, verbs: null, accepts: [] },
  { name: "rename", brief: packedBrief("rename"), summary: packedAccount("rename"), handler: cmdCall, verbs: null, accepts: [] },
  { name: "msg", brief: packedBrief("msg"), summary: packedAccount("msg"), handler: cmdCall, verbs: null, accepts: [] },
  // THE LONG LINE (landing 16): `watch` holds its calls in a loop, one has line per change (`commands/watch-line.ts`).
  { name: "watch", brief: packedBrief("watch"), summary: packedAccount("watch"), handler: cmdCall, verbs: null, accepts: [] },
  { name: "repo",          brief: packedBrief("repo"), summary: packedAccount("repo"), handler: cmdRepo, verbs: TUNNEL_VERBS, accepts: ["brief", "familiar", "force", "probe", "root", "staged"] },
  { name: "home",          brief: packedBrief("home"), summary: packedAccount("home"), handler: cmdHome, verbs: TUNNEL_VERBS, accepts: ["brief", "familiar", "force", "probe", "root", "staged"] },
  { name: "sense",         brief: packedBrief("sense"), summary: packedAccount("sense"), handler: cmdSense, pathAccepts: sensePathAccepts, verbs: SENSE_VERBS, leads: "<sensorium>", accepts: ["agent", "all", "all-strata", "approve", "as-of", "bulk", "channel", "confirm", "device", "drain", "dry-run", "ephemeral", "force", "freeze-receipt", "function", "grounds", "halves", "hold", "imago", "intent", "k", "keep-hooks", "lens", "limit", "list", "min-count", "model-home", "names", "not-root", "pair", "palace", "project", "reason", "repour", "revision", "room", "self-weight", "sensorium-root", "session-id", "signal", "source-host", "source-key", "span", "speaker", "spectral", "store-swap", "surface", "trial-root", "wing", "writeback"] },
  { name: "flow",          brief: packedBrief("flow"), summary: packedAccount("flow"), handler: cmdFlowRun, verbs: null, accepts: ["names", "signal", "target"] },
  { name: "ddate",         brief: packedBrief("ddate"), summary: packedAccount("ddate"), handler: cmdDdate, verbs: null, accepts: [] },
  { name: "mempalace",     brief: packedBrief("mempalace"), summary: packedAccount("mempalace"), handler: cmdMempalace, passesThrough: (a) => a.positional[0] !== undefined && !MEMPALACE_OWN_VERBS.includes(a.positional[0]), verbs: MEMPALACE_OWN_VERBS, accepts: ["confirm", "dry-run", "help-mempalace", "hold", "keep-hooks", "project", "wing"] },
  { name: "spirit",        brief: packedBrief("spirit"), summary: packedAccount("spirit"), handler: cmdSpirit, verbs: SPIRIT_VERBS, accepts: ["add", "allowed-tools", "aperture", "base", "cap", "caps", "echo", "expect", "face", "file", "fold", "grant", "grants", "handback", "held", "instance", "key", "lane", "lanes", "line", "links", "log", "mandate", "model", "new", "offer", "parent", "paths", "reads", "record", "slot", "source", "stream", "streams", "text", "title", "transcripts", "witness", "workdir"] },
  { name: "hooks",         brief: packedBrief("hooks"), summary: packedAccount("hooks"), handler: cmdHooks, verbs: HOOKS_VERBS, accepts: ["reason"] },
  { name: "mcp",           brief: packedBrief("mcp"), summary: packedAccount("mcp"), handler: cmdMcp, verbs: MCP_VERBS, accepts: [], passesThrough: () => true },
  { name: "sensorium",     brief: packedBrief("sensorium"), summary: packedAccount("sensorium"), handler: cmdSensorium, verbs: SENSORIUM_VERBS, accepts: ["all", "evidence", "keep", "name", "orphans", "projection"] },
  { name: "vault",         brief: packedBrief("vault"), summary: packedAccount("vault"), handler: cmdVault, verbs: VAULT_VERBS, accepts: ["all", "as", "cards", "face", "memory", "out", "paper", "passphrase", "rotate", "verbose"], signs: true /* holds and rotates persona key material */ },
  { name: "wear",          brief: packedBrief("wear"), summary: packedAccount("wear"), handler: cmdWear, verbs: null, accepts: ["face", "yes"] },
  { name: "library",       brief: packedBrief("library"), summary: packedAccount("library"), handler: cmdLibrary, verbs: LIBRARY_VERBS, accepts: ["keep", "licence", "license", "note", "origin", "out", "to"] },
  { name: "persona",       brief: packedBrief("persona"), summary: packedAccount("persona"), handler: cmdPersona, pathAccepts: (a) => a.positional[0] === "raise-sign" ? ["as"] : PERSONA_ROW.filter((n) => n !== "as"), verbs: PERSONA_VERBS, accepts: ["as", "chair", "face", "handle", "name", "nexus", "prefix", "seat", "seat-key", "split-root", "threshold"], signs: true /* mints persona roots */ },
  { name: "circle",        brief: packedBrief("circle"), summary: packedAccount("circle"), handler: cmdCircle, verbs: CIRCLE_VERBS, accepts: ["card", "face", "petname", "to"] },
  { name: "cabal",         brief: packedBrief("cabal"), summary: packedAccount("cabal"), handler: cmdCabal, verbs: CABAL_VERBS, accepts: ["applicant", "bundle", "cap", "face", "nexus", "realm"], signs: true /* a vouch STAKES the voucher's own standing */ },
  { name: "edge",          brief: packedBrief("edge"), summary: packedAccount("edge"), handler: cmdEdge, verbs: EDGE_VERBS, accepts: ["as", "face", "realm", "nexus", "member", "device", "quorum", "fleet", "partial", "voucher", "joiner", "from", "act"], signs: true /* a kapae act signs over a relationship */ },
  { name: "nexus",         brief: packedBrief("nexus"), summary: packedAccount("nexus"), handler: cmdNexus, pathAccepts: (a) => a.positional[0] === "approve" ? (a.positional[1] === "open" ? ["purpose", "surface", "class", "nexus", "out"] : a.positional[1] === "sign" ? ["confirm-hash", "confirm-statement", "nexus", "out"] : a.positional[1] === "check" ? ["nexus"] : null) : null, verbs: NEXUS_VERBS, accepts: ["act", "added", "apply", "approval", "carrier", "carry", "charter", "charter-law", "class", "cold-key", "confirm-hash", "confirm-statement", "contract", "cosign", "cut", "edge", "expiry", "face", "floor-pin", "from", "heard", "heard-threshold", "index", "join", "land", "list", "nexus", "note", "out", "purpose", "realm", "reason", "release", "sig", "source", "steward", "surface", "sync-url", "terms", "thin", "threshold", "tier", "with"], signs: true /* quorum-signs admits, kapae and charter acts */ },
  { name: "fleet",         brief: packedBrief("fleet"), summary: packedAccount("fleet"), handler: cmdFleet, verbs: FLEET_VERBS, accepts: ["doc-url", "face", "out", "sync-url"], signs: true /* signs a device edge, certificates, grants and the answer */ },
  { name: "handle",        brief: packedBrief("handle"), summary: packedAccount("handle"), handler: cmdHandle, verbs: HANDLE_VERBS, accepts: ["card", "face", "from-persona", "glamour", "persona", "return-locator", "subject", "surface"], signs: true /* mints + signs a HandleCard */ },
];

/** THE RELEASE LEFT THE READ: `vessel read vessel --release*` names its new door, and reads nothing. */
function movedRelease(args: ParsedArgs): boolean {
  if (args.command !== "vessel" || args.positional[0] !== "read") return false;
  return ["release", "release-keep", "release-fresh"].some((n) => n in args.options || n in args.flags);
}

/** The door rows a sub-path narrows (`pathAccepts`), read off the table itself so the two never drift. */
function rowOf(name: string): readonly string[] { return COMMANDS.find((c) => c.name === name)?.accepts ?? []; }
const VESSEL_ROW  = { filter: (f: (n: string) => boolean) => rowOf("vessel").filter(f) };
const INGEST_ROW  = { filter: (f: (n: string) => boolean) => rowOf("ingest").filter(f) };
const PERSONA_ROW = { filter: (f: (n: string) => boolean) => rowOf("persona").filter(f) };

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
  // A row whose key rests on SOME sub-verbs alone names them beside its brief, so the ✍ mark never vows more than the doors do.
  // A brief that already lists the verbs (a packed door names them where its roles overrun the line) marks each signing
  // verb in place, so the one line still fits; any other brief names them after it.
  const brief = (name: string, summary: string): string => {
    const row = COMMANDS.find((c) => c.name === name);
    const text = row?.brief ?? summary;
    const only = row?.signsOnly;
    if (!only) return text;
    const verbs = text.split(" · ");
    if (only.every((v) => verbs.includes(v))) return verbs.map((v) => (only.includes(v) ? `✍ ${v}` : v)).join(" · ");
    return `${text} (✍ ${only.join(", ")} alone)`;
  };
  // THE FIRST RUNG OF PROGRESSIVE DISPLAY: one line per door, its carrier's one line beside it; depth unfolds per door
  // (`lares <door> --help`, a slot, the whole), so the list caps no terminal width (the role law caps each line at its carrier).
  console.log("lares — operator CLI for the Lares lararium stack");
  console.log("Usage:  lares <command> [args...]    (lares <command> --help: examples, then the full account)\n");
  if (surface !== VERB_SURFACE.cli || executableOnly) {
    console.log(`Surface: ${surface}${executableOnly ? " (executable — key-holding acts withheld)" : ""}`);
  }
  if (shown.length === 0) {
    console.log(`\nNo verbs project onto "${surface}" — a surface exposes what asked to be exposed.\n`);
    return;
  }
  const groups: [string, string][] = [["host", "Host (runs on this machine)"], ["vessel", "Vessel (answers from the house)"], ["mixed", "Mixed (some of each)"]];
  // A blank parts two groups; the footer follows the last one.
  const listed = groups.map(([scope, title]) => [title, shown.filter((c) => commandScope(c.name) === scope)] as const).filter(([, rows]) => rows.length > 0);
  listed.forEach(([title, rows], at) => {
    console.log(`${title}:`);
    for (const c of rows) console.log(`  ${c.signs ? "✍ " : "  "}${c.name.padEnd(13)} ${brief(c.name, c.summary)}`);
    if (at < listed.length - 1) console.log("");
  });
  // The house and the path spelling share one footer line.
  console.log("  The house: LAR_ROOT's, else ~/.lares/lares-surface.env's; a path crosses as /lar/<class>.");
  if (shown.some((c) => c.signs)) {
    console.log("  ✍ = holds a key. An agent surface may compose these and MUST NOT execute them.");
  }
  // The usage line already names `lares <command> --help`; the TTY rule rides the flags' own header, one line spared.
  console.log("Global flags (prose on a TTY, JSON off-TTY or under --json):");
  console.log(`  ${"--json".padEnd(14)} Emit a deterministic JSON result (ok|error + requestId); status reads need it.`);
  console.log(`  ${"--no-json".padEnd(14)} Force human prose even when stdout is not a TTY.`);
  console.log(`  ${"--yes".padEnd(14)} Skip confirmation prompts (required for non-interactive runs).`);
  console.log(`  ${"--keyhive-trace".padEnd(15)} Print Keyhive's DEBUG/TRACE lines (${KEYHIVE_TRACE_ENV}=1 too).`);
}

/** `-h` spells `--help` (clig.dev), and a leading help flag names the `help` command, so `lares --help` prints what
 *  `lares help` prints. Tokens after a bare `--` ride untouched. */
function spellHelp(argv: readonly string[]): readonly string[] {
  const end = argv.indexOf("--");
  const head = (end === -1 ? argv : argv.slice(0, end)).map((t) => (t === "-h" ? "--help" : t));
  const out = [...head, ...(end === -1 ? [] : argv.slice(end))];
  if (out[0] !== "--help") return out;
  const rest = out.slice(1);
  return rest[0] === undefined || rest[0].startsWith("--") ? ["help", ...rest] : out;
}

/**
 * MOVED maps a spelling outside the front door to the line that answers for it. The spelling runs nothing, and it never
 * answers `unknown command` either: an operator who types it meets the seat that answers, by name.
 * A row matches when its words lead the command line. `tools/door-names-witness.sh` reads every `lares …`
 * cure here against the live registry, so a seat that moves again cannot leave a row pointing at nothing.
 */
export const MOVED: ReadonlyArray<{ readonly argv: readonly string[]; readonly to: string }> = [
  { argv: ["promote"], to: "lares trust" },
  { argv: ["nexus", "promote"], to: "lares nexus approve" },
  // Verbs that ride the door owning their island (fewer-front-doors).
  { argv: ["receipt"], to: "lares vessel request <id>" },
  { argv: ["cancel"], to: "lares vessel request <id> --cancel" },
  // `watch` left this table at landing 16: the word stands again as a call verb (a filter subscription), and the ingest watch
  // still rides `lares ingest --watch`.
  { argv: ["draft"], to: "lares act lar:///carriage.draft.pulls uri=<uri>" },
  { argv: ["raise"], to: "lares persona raise-sign <challenge-json-text>" },
  { argv: ["wing-of"], to: "node tools/wing-of.mjs" },
  // Residency rides `wiki status`; the wiki's pointer rides `wiki switch` and the face's keep list rides `wiki keep`.
  { argv: ["bag", "stats"], to: "lares wiki status" },
  { argv: ["bag", "list"], to: "lares bag show [<slug>]" },
  { argv: ["wiki", "list"], to: "lares wiki status" },
  { argv: ["wiki", "active"], to: "lares wiki status" },
  { argv: ["test-quine"], to: "pnpm --filter @lararium/node test:quine" },
];

/** The line MOVED maps this command line to, or null where no MOVED row leads it. */
function movedTo(args: ParsedArgs): string | null {
  const line = [args.command, ...args.positional];
  const row = MOVED.find((m) => m.argv.every((w, i) => line[i] === w));
  if (row) return row.to;
  if (movedRelease(args)) return "lares vessel release <documentId> [--keep|--fresh]";
  return args.command === "sense" && retiredSensePromote(args) ? "lares sense harden" : null;
}

/** The door table as the keyword reader takes it: each door's name and the flags its handlers read. */
const KEYWORD_DOORS = { names: COMMANDS.map((c) => c.name), accepts: (door: string): readonly string[] => COMMANDS.find((c) => c.name === door)?.accepts ?? [] };

/**
 * ONE DOOR, KEYWORD PARAMS (the keyword head, `../keywords.ts`): a keyword line, whose first token names a keyword
 * (`lares rite=kukulu mu=_0`, `lares get=<title> aperture=arc`), reads to the line it runs: a call through the call door in
 * the call shape (`get title=…`), or a door the command table runs by position with its dials folded into its own flags. The
 * set panel's own keywords (stance · mode · mood · note) echo on stderr as the set line the call rode. A keyword line the reader refuses answers its teaching
 * refusal and exits 2. Null where the line names no keyword.
 */
export function keywordArgv(argv: readonly string[]): { readonly line: KeywordLine; readonly argv: readonly string[] } | { readonly refused: string } | null {
  if (!isKeywordLine(argv)) return null;
  let line: KeywordLine;
  try { line = readKeywords(argv, KEYWORD_DOORS); }
  catch (err) { if (err instanceof KeywordUsage) return { refused: err.message }; throw err; }
  if (line.kind === "call") return { line, argv: [line.verb, ...Object.entries(line.params).map(([k, v]) => `${k}=${v}`)] };
  if (line.kind === "door") return { line, argv: line.argv };
  return { line, argv: [BARE_ADDRESS, ...Object.entries(line.params).map(([k, v]) => `${k}=${v}`)] };
}

/**
 * THE BARE DOOR (`commands/bare.ts`): bare `lares` reads `lares mu=00 aperture=beat`, the terminal spelling of
 * lar:///lares.lararium.status. It runs here, at the terminal, whether or not the house answers: a dark house reads as a
 * report. Its views run other doors through this dispatcher; `aperture=theme` adds the full door list `lares help` prints.
 */
async function bareDoor(params: Readonly<Record<string, string>>): Promise<number> {
  return await cmdBare(params, liveReaders((argv) => dispatch(argv)), COMMAND_NAMES, async () => { printHelp(); return 0; });
}

/** The set line a keyword call rode, echoed on stderr where it names any of the panel's own keywords. */
function echoSet(line: KeywordLine): void {
  const keys = Object.entries(line.set);
  if (keys.length > 0) console.error(`<<~ set ${keys.map(([k, v]) => `${k}=\`${v}\``).join(" ")}>>`);
  if (line.kind === "door") for (const note of line.notes) console.error(`lares: ${note}`);
}

export async function dispatch(rawArgv: readonly string[]): Promise<number> {
  const keyed = keywordArgv(rawArgv);
  if (keyed !== null) {
    if ("refused" in keyed) { console.error(`lares: ${keyed.refused}`); return 2; }
    echoSet(keyed.line);
    return await dispatch(keyed.argv);
  }
  const argv = spellHelp(rawArgv);
  let args: ParsedArgs;
  try { args = parseArgs(argv); }
  catch (err) {
    if (!(err instanceof ArgsError)) throw err;
    console.error(`lares: ${err.message}`);
    return 2;
  }
  // Keyhive's trace, asked by name: set before any command stands a provider or a vessel.
  askKeyhiveTrace(args.flags);
  // Global help: `lares help`, or `lares --help` with no command (bare `lares` speaks the house, above).
  //
  // A NAME THAT DOES NOT ANSWER MUST NOT ANSWER SOFTLY. Routing an unknown command to the global menu
  // returns 0 and prints a full page, which reads exactly like a door that opened — so a caller probing
  // `lares <name> --help` cannot tell a live verb from a name no door answers, and the collapse's own law
  // (one spelling per door) stops being checkable from outside. The unknown-command refusal
  // below therefore owns EVERY unknown name, flags included.
  // BARE `lares` SPEAKS THE HOUSE (the keyword head): the status line, the layered pins, the keys; the full door list moved behind
  // `lares help`. A bare line that names a flag (`lares --json`, `--surface`) still asks the menu's machine shape.
  const bareFlags = [...Object.keys(args.options), ...Object.keys(args.flags)];
  if (args.command === null && bareFlags.length === 0) return await bareDoor({});
  // The bare door's address, as the bridge forwards a bare line or a keyword line naming no act keyword into the vessel's host.
  if (args.command === BARE_ADDRESS) {
    const params: Record<string, string> = {};
    for (const token of args.positional) { const eq = token.indexOf("="); if (eq > 0) params[token.slice(0, eq)] = token.slice(eq + 1); }
    return await bareDoor(params);
  }
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
  const moved = movedTo(args);
  if (moved) { console.error(`usage: this command moved to \`${moved}\``); return 2; }
  // A CALL WORD'S POSITIONAL SPELLING BURNED (the keyword head): `lares get Room4` reads as `lares get=Room4`; run that.
  const cure = args.flags["help"] === true ? null : positionalCure(args.command, args.positional);
  if (cure !== null) {
    console.error(`lares: keyword-positional: \`lares ${[args.command, ...args.positional].join(" ")}\` reads as \`${cure}\`; run that`);
    return 2;
  }
  // AN ADDRESS NAMES ITS OWN VERB (comms-ux-enacts landing 8): `lares lar:///<address> name=value…`, `lares act lar:///<address> …`
  // and `lares -` (one call sigil on stdin) ride the call door, which takes params alone, past every door's flag table.
  if (isCallHead(args.command, args.positional) && !(CALL_WORDS as readonly string[]).includes(args.command ?? "")) {
    const flags = [...Object.keys(args.options), ...Object.keys(args.flags)].filter((n) => !GLOBAL_FLAGS.includes(n) || n === "meme");
    if (flags.length > 0) {
      for (const name of flags) {
        // THE FLAG ZOO BURNED INTO THE DIALS (the keyword head): a burned flag names the dial it reads as.
        const dial = BURNED_FLAGS[name];
        console.error(dial !== undefined ? `lares: --${name} burned into the dials: it reads as ${dial} on a call` : `lares: unknown flag --${name} for a call; a call takes name=value params (${name}=…)`);
      }
      return 2;
    }
    // THE ONE ACT'S HELP (landing 9): `lares act --help` with no address prints the act carriers' call shapes, drawn from the pack.
    if (args.command === "act" && args.positional.length === 0 && args.flags["help"] === true) {
      for (const line of helpLines("act")) console.log(line);
      return 0;
    }
    return await cmdCall(args);
  }
  const cmd = COMMANDS.find((c) => c.name === args.command);
  if (!cmd) {
    // A SHIM VERB'S HELP: the host shim answers `up|down|reset|found|logs|build|rebuild`, and a help ask stays on this machine,
    // so the row reads here (`shimHelpLines`) instead of refusing a name the shim owns.
    const shim = args.flags["help"] ? shimHelpLines(args.command) : null;
    if (shim !== null) { for (const line of shim) console.log(line); return 0; }
    console.error(`lares: unknown command "${args.command}".  Run \`lares help\` for the list.`);
    return 2;
  }
  // Per-command help: `lares <command> --help` renders the door's carriers (the baked pack) and returns, never running the
  // handler. A verb a carrier skins answers for itself (`lares vessel rite --help`), so a sub-verb's flags reach the reader
  // instead of its parent's; the carrier's `Law:` lines name the memes behind it, which `lares get title=<uri> aperture=arc` reads.
  if (args.flags["help"]) {
    renderCommandHelp(helpDoor(cmd.name, args.positional), cmd.summary);
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
  seatNewFaceRoute();
  // An act this process runs itself with no ward route asks the person at this terminal, once per act (seat-harness#/the-ward).
  seatTtyWardGatherer();
  try {
    return await cmd.handler(args);
  } catch (err) {
    // A sealed row that stayed shut names itself on one line: the key was not opened, or a row does not open.
    if (err instanceof OfflineCustodyRefused || err instanceof CustodyLocked || err instanceof CustodyRecordUnavailable) {
      console.error(`lares ${cmd.name}: ${err.message}`);
      return 1;
    }
    // A sealed act the vessel refused names itself on one line under its reason, whichever command let it travel.
    if (err instanceof SealedActRefused) {
      emit(args, { ok: false, error: { code: err.reason, message: err.message }, human: () => console.error(`lares ${cmd.name}: ${err.message}`) });
      return exitFor(err.reason);
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

/**
 * ONE WORD RIDES THE ARGV INTO THIS ENTRY, and the entry takes it off before any verb reads it (`takeEntryAsks`), so no
 * verb's parser meets it and no child a verb spawns inherits it: a caller's declared budget (`--ask-budget-ms=<N>`) bounds
 * this process's own wait (`armAskBudget`: the verb's answer disarms it, and a budget that runs out first leaves at once,
 * since nothing answered and so nothing waits to drain). THE STANDING RIDES NO WORD AND NO EXIT CODE: a verb that succeeded
 * under a shim's exec tag REPORTS the standing verdict into the house's config bind as it leaves (`reportStanding`), and
 * the exit code stays the verb's own, so one process serves one call and no caller reads a changed code.
 */
export function runCli(): void {
  const { argv, budgetMs, retiredAsk } = takeEntryAsks(process.argv.slice(2));
  const disarm = armAskBudget(budgetMs);
  // A KEYWORD LINE ROUTES AS THE LINE IT READS: the host reads it once (its set line echoed here), and the line it runs crosses the
  // bridge, so `lares rite=kukulu` stands where `lares rite kukulu` stands and `lares get=<title>` forwards into the vessel.
  const keyed = keywordArgv(argv);
  if (keyed !== null && !("refused" in keyed)) echoSet(keyed.line);
  // A BARE LINE ROUTES AS THE BARE DOOR'S ADDRESS, so a container house answers it from the vessel's own host.
  const routed = keyed !== null && !("refused" in keyed) ? [...keyed.argv] : argv.length === 0 ? [BARE_ADDRESS] : argv;
  bridge(forwardedArgv(routed, budgetMs), COMMAND_NAMES).then((forwarded) => forwarded ?? dispatch(routed)).then(
    async (code) => {
      disarm?.();
      try { await drainStdout(); }
      catch (err) { console.error(err); process.exitCode = 1; return; }
      process.exitCode = code;
      // A forwarded call reports nothing here (the shim's exec ran the verb, and that process reports); a call carrying the
      // retired ask comes from a shim that reads no report, so none gets written for it.
      if (!retiredAsk) await reportStanding(code);
    },
    (err)  => { disarm?.(); console.error(crashReading(err)); process.exitCode = houseRootUnnamed(err) ? HOUSE_ABSENT_EXIT : 1; },
  );
}

/**
 * A FORWARDED CALL KEEPS ITS BUDGET (the process that reaches the vessel leaves under it too).
 */
function forwardedArgv(argv: string[], budgetMs: number | null): string[] {
  return budgetMs === null ? argv : [...argv, `${ASK_BUDGET_FLAG}=${budgetMs}`];
}

/** By name: the node and the mempalace packages each raise their own HouseRootUnnamed class. */
function houseRootUnnamed(err: unknown): boolean {
  return err instanceof Error && err.name === "HouseRootUnnamed";
}

/**
 * What an uncaught failure prints. An unnamed house root names its cure in two lines, never a stack trace;
 * `LARES_DEBUG=1` prints the whole error, stack and all, for every failure.
 */
export function crashReading(err: unknown, env: Record<string, string | undefined> = process.env): unknown {
  if (env["LARES_DEBUG"] === "1" || !houseRootUnnamed(err)) return err;
  return "lares: no house root: LAR_ROOT names none here\n" +
    "lares: set LAR_ROOT to a house root, or stand the container house (~/.lares/lares-surface.env) and run tools/lares-container.sh up";
}

if (invokedAsScript) {
  runCli();
}
