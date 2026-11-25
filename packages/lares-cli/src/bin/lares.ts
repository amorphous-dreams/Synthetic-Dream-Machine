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
import { seatOfflineCustody, OfflineCustodyRefused } from "../offline-custody.js";
import { seatNewFaceRoute } from "../face-route-prompt.js";
import { cmdHerm }                    from "../commands/herm.js";
import { cmdHost }                    from "../commands/host-cmd.js";
import { cmdWalk }                    from "../commands/walk-cmd.js";
import { cmdMemeSurface }             from "../commands/meme.js";
import { cmdBag, bagHelpLines }                     from "../commands/bag.js";
import { cmdEvents }                  from "../commands/events.js";
import { cmdWiki, wikiHelpLines }                  from "../commands/wiki.js";
import { cmdTiddler }                 from "../commands/tiddler.js";
import { ACT_VERBS, actHelpLines, cmdAct }                     from "../commands/act.js";
import { cmdIngest }                  from "../commands/ingest.js";
import { cmdExport }                  from "../commands/export.js";
import { cmdImport }                  from "../commands/import.js";
import { cmdShore, shoreHelpLines }                   from "../commands/shore.js";
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
import { COMPACTION_DISPLAY, COMPACTION_WORD } from "../spirit-words.js";
import { cmdMcp }                     from "../commands/mcp.js";
import { cmdLei }                     from "../commands/lei.js";
import { cmdRite }                    from "../commands/rite.js";
import { cmdSensorium }               from "../commands/sensorium.js";
import { cmdHome, cmdRepo }           from "../commands/tunnel-door.js";
import type { VerbTable } from "../verb-table.js";
import { COMMAND_HELP, renderCommandHelp, helpDoor, seatAbout } from "../command-help.js";
import { emit, exitFor } from "../render.js";
import { storeFailure } from "../store-door.js";
import { reachHelpMeme }              from "../help-meme.js";
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
import { TIDDLER_VERBS } from "../commands/tiddler.js";
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
  readonly brief?:      string;
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
  /** The door's own help where it keeps a sub-verb table (`wiki`): `--help` prints these lines when the registry holds no row. */
  readonly help?:       () => readonly string[];
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
  const known = [...new Set([...(cmd.pathAccepts?.(args) ?? cmd.accepts), ...GLOBAL_FLAGS])];
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

export const COMMANDS: readonly Command[] = [
  { name: "intent", brief: "Issue and read a face's signed intents.", summary: "Issue and read a face's signed intents; every invocation names --face N when several faces stand.", handler: cmdIntent, verbs: INTENT_VERBS, accepts: ["face", "to", "prefer", "class", "every", "args", "nonce", "prev", "void-at", "through", "executor", "detail", "deny", "agent", "prefix", "policy", "as-of", "until"], signs: true },
  { name: "trust", summary: "Manage a wiki’s promotions.", handler: cmdPromote, verbs: TRUST_VERBS, accepts: ["face", "wiki", "why", "keep", "drop"], signs: true },
  { name: "kapae", summary: "Manage a wiki’s promotion brake.", handler: cmdKapae, verbs: KAPAE_VERBS, accepts: ["face", "wiki", "why", "keep", "drop"], signs: true },
  { name: "lei", brief: "String, read and end a lei.", summary: "THE LEI DOOR — a lei grants one rite (`push` · `kukulu` · `keep`) at one branch under one reach. `show [--rite <r> --branch <b> [--head <h>]]` reads the swarm board and, with a line named, that rite's standing lei (its reach and the returns left; a head asks after one head). `kui --rite <r> --branch <b> --returns <n> [--after <lei cid>]` strings a wide lei, which names no head and carries its returns (more than twelve asks `--yes`); `kui … --reach head --head <h>` pins one head. `unstring --rite <r> --branch <b> --lei <cid>` revokes a lei that still holds returns, by a signed record that deletes nothing. `restring --rite <r> --branch <b> [--returns <n> | --reach head --head <h>]` supersedes the standing lei with a newer one. The hand alone strings, unstrings and restrings: each signs under the face's ward, and a push lei waits on a second device where the face holds two (a kukulu stays on the device and waits on none, and so does a keep, whose branch names the workspace it lays the bundle into). A return rests on the hand's signed lei (a `push` lei adds its ward co-sign). Under a pūlama the hand signs at the pūlama's hand door (`pulama-main.js lei kui|restring|unstring '<terms>'`) and `land '<answer>'` lands the record it signed; `terms kui|restring|unstring` (the same flags as the act) prints that one terms line, the face filled from `--face`, else a keep's own face, else the daemon mount, and a restring's `after` from the line's tip, writing nothing and asking no route. `kui … --all` strings one lei for every open face under ONE route, each face's own record by its own hand at its own line's tip (under a pūlama its terms name `faces`, and the pūlama signs each), and names each face's cid; `show --rite --branch` naming no face reads every open face's line.", handler: cmdLei, verbs: LEI_VERBS, accepts: ["rite", "branch", "head", "reach", "returns", "after", "lei", "face", "scope", "all"], signs: true, signsOnly: ["kui", "unstring", "restring"] },
  { name: "rite", brief: "Run a rite that spends a lei: kūkulu raises the vessel; keep backs memory up.", summary: "THE RITE DOOR — `kukulu` (kūkulu) runs on the host, the one verb that raises the house again, and reads where the house stands on every run: it fast-forwards the checkout where it stands clean and behind its upstream, has the host shim make the image (the tag, a kept image, or a build from the commit), begins the rite in the standing vessel where a kukulu lei stands (the vessel derives the head's tree from git, returns the lei and rests the guest half of a tessera, `rite-begun`; no lei runs the restand with no rite), and then the shim's restand takes the vessel down and raises a new one; the vessel that stands after rests the host half (`rite-landed`), naming the begun half. A pūlama whose code moved or that stands unlit lights on this terminal in the same run, and an image no admission and no lei carries asks the pūlama's admit; with no terminal, a day owing either stops before anything moves and names the hand act, and every other day flows. `--rollback [<rev>]` stands the image that ran before (or an older revision's) with no checkout move. A new vessel that stands locked names the unlock and the landing still owed. `begin --rite <r> --branch <b> --head <h>` and `land --tessera <id> --head <h>` run those two rows alone; `receipts` lists every half (`data.receipts`) with conferre's read of them (`data.conferre`: `par` for a match, `red` for a half with none). `keep --workspace <name> [--into <path>] [--accept-omissions]` runs on the host: it guards the workspace clone (a repo on a branch with a remote, a committed `* -text` .gitattributes, nothing changed outside `<into>`), runs `keep-cut` in the vessel, guards what the cut left (only `<into>` changed, no secret-shaped string), commits `keep <bundleId>`, rebases and pushes, then lands the tessera at the bundle id the pushed manifest names; a push that fails lands nothing and names the cure (mend the remote and run keep again), and an unchanged keep commits nothing. `keep --if-due` (the one call `down` makes) keeps only where the house moved since the bundle its remote-tracking branch holds, or where a keep still waits for its push or landing: an unmoved house spends nothing and touches no remote; with no `--workspace` it reads LARES_KEEP_WORKSPACE (else the one LARES_WORKSPACES pair), and a config naming none keeps nothing. `keep-cut` takes the same flags and runs in the vessel: it reads the keep line for that workspace (no standing lei refuses before any cut), cuts a `lar-house-bundle` bundle (the written content in plaintext, its roster sealed under the house's keep key) beside the place it names inside the bound workspace (`<root>/workspaces/<name>/<into>`, `house` where absent), reads every byte back against its manifest, begins the rite at that id (the return and the guest half), and only then moves the bundle into place over the one an earlier keep left; a workspace that already holds this very bundle spends nothing. The hand strings the lei first: `lares lei kui --rite kukulu --branch <b> --returns <n>`, or `--rite keep --branch <workspace> --returns <n>`.", handler: cmdRite, verbs: RITE_VERBS, accepts: ["rite", "branch", "head", "tessera", "face", "image", "workspace", "into", "accept-omissions", "staging", "if-due", "sessions", "rollback", "keeper-to", "keeper-next"] },
  { name: "kahua", brief: "Stage, lift and read a face's kahua stage.", summary: "One face's kahua stage: `mint` its pin, `propose` and `stage` (any seat; `stage` writes a row into the face's local canon bags/daemon-<F>, unsigned), `lift` (one staged row by title and digest: a preview, then the digest typed back or `--digest`; a bare --yes lifts nothing), `withdraw` and `carry` (the operator's hand: the lōkahi cap and the grant out of sealed custody; a carry stands earlier items again after a root rotation), `get [<title>]` reads its verified items; answers print as JSON.", handler: cmdKahua, pathAccepts: (a) => a.positional[0] === "get" ? (a.positional[1] ? ["face", "history"] : ["face", "history", "after", "limit"]) : a.positional[0] === "list" ? null : ["face", "text", "file", "digest", "taint", "sources", "parent", "proposal", "proposals", "fields", "all"], verbs: KAHUA_VERBS, accepts: ["face", "text", "file", "digest", "taint", "sources", "parent", "proposal", "proposals", "fields", "history", "after", "limit", "all"], signs: true, signsOnly: ["mint", "lift", "withdraw", "carry"] },
  { name: "intent-relay", brief: "Enable, disable, inspect or rotate a face's intent relay door.", summary: "Enable, disable, inspect or rotate one face's sealed intent relay admission door.", handler: cmdIntentRelay, verbs: INTENT_RELAY_VERBS, accepts: ["face", "json"], signs: true },
  { name: "vessel",        brief: "Found, stand, stop, lay and read the vessel; read or cancel a request.", summary: "THE VESSEL DOOR \u2014 one namespace over the vessel's own causal island (store, genesis artifact, daemon, corpus). Four primitives and one read: `found` mints identity + bootstrap (`--hearth --name <label>`: the Stable founding act, a hearth with persona zero and its one-seat seed charter; `--hearth --restore <bundle>`: the same act with a restored face as persona zero; bare: a place with no face, which joins a face by `lares fleet join`) \u00b7 `stand` brings the daemon up and reports ([--foreground] [--with-web] [--restart] [--page]) \u00b7 `stop` halts it on the port \u00b7 `lay` lays every bags/* holding back into its doc \u00b7 `read` inspects and starts nothing, and needs no verb, so it answers a fallen vessel too (the resting engine falls and every held id, read from the files beside the store) \u00b7 `release <documentId>` ends one quarantine hold with the vessel stopped (bare: the bytes return; `--keep`: what stands under the id stays; `--fresh`: a plane no sibling carries starts empty), holding the store for its act; `roster` reads who is home (the worn face and who holds it, the seats here by presence and far by last signed act, the lanes, the open vota). `request <requestId>` reads a verb request's receipt without dispatching anything, and `request <requestId> --cancel` withdraws it before it is read: the operator's OWN explicit withdrawal, marking the id abandoned so a later line under the same id refuses rather than running, never sent on a bare timeout by any automated path. Compositions ride `vessel rite <petname>` \u2014 founding \u00b7 refresh \u00b7 rebuild, so a new cap-stack arrives as a rite, never as another top-level verb. A fresh founding composes: found \u00b7 stand \u00b7 lay. Advancing the genesis composition is a MESH act \u2014 `nexus kahuli` \u2014 never a vessel door.", handler: cmdVessel, pathAccepts: (a) => a.positional[0] === "request" ? ["cancel"] : VESSEL_ROW.filter((n) => n !== "cancel"), verbs: VESSEL_SUBS, accepts: ["apply", "bag", "cancel", "chair", "change-id", "cold-key", "cut", "docs", "dry-run", "force", "foreground", "fresh", "genesis", "grain", "hearth", "image", "in-wiki", "init", "keep", "lag", "lift-kahua", "name", "nexus", "observe", "page", "palaces", "porch", "port", "restart", "restore", "root", "shadow", "storage", "tag-blobs", "verbose", "wiki", "with-web", "workbench"], signs: true /* found mints the vessel key + persona root; lay writes founding material */ },
  { name: "herm", brief: "Stand the herm crossroads; rotate its relay gate.", summary: "Stand the herm crossroads; `herm relay-rotate` mints a new durable relay service gate and prints the new pin. Restart the herm and hand dialing hearths the new pin.", handler: cmdHerm, verbs: HERM_VERBS, accepts: ["port", "relay-port"] },
  { name: "host",          brief: "Read and roll what this hearth hosts; mint invites.", summary: "THE HEARTH'S HOSTING DOOR — a hearth hosts walkers in a Nexus it carries. `lares host` reads what it hosts: per Nexus, the live epochs (each the CID of a signed hosting act), the cap, and how many invites were redeemed (counts, never rows). `host roll [--nexus <aid>] [--cap <n>]` signs the next hosting act with the per-Nexus leaf of the hosting face (at the first roll, `--face N`, else the one face standing open) and lands it on this hearth's hosting doc in the Nexus; grants and tokens live for the current and previous epoch, so rolling twice is the hard roll. `host invite [--nexus <aid>] [--relay <ws-url>]` mints this hearth's own invite at the current epoch and prints the one `lar-invite:` string to carry — it redeems once, at this hearth's own gate, and nothing about it is kept. While the vessel stands, each door runs inside it. The walker route ships SHUT by name (the shut-routes house ruling, stable-founding-road #/rulings): the epoch and the invite are written, but no gate seats a walker until a live grant reader opens the route.", handler: cmdHost, verbs: HOST_VERBS, accepts: ["cap", "face", "nexus", "relay"], signs: true },
  { name: "walk",          brief: "Walk in at another hearth on an invite.", summary: "THIS VESSEL'S WALKING DOOR — a vessel walks in at another hearth on an invite, as one face (`--face N`, else the one face standing open). `lares walk` reads where it walks: per hearth, the Nexus, whether its invite still waits to settle, the grant it holds, and how many invites its wallet holds. `walk take <lar-invite:…>` keeps a carried invite durably, and the vessel's hearth dial walks in on it; a vessel walks at one hearth, so a take for a second refuses and writes nothing. `walk invite` hands the newest invite out of the wallet as one string to carry. A node carries none of its documents at a hearth — it is its own durable store. While the vessel stands, each door runs inside it. The walker route ships SHUT by name (the shut-routes house ruling, stable-founding-road #/rulings): the invite is kept, but no hearth gate seats a walk until a live grant reader opens the route.", handler: cmdWalk, verbs: WALK_VERBS, accepts: ["face"] },
  { name: "act",           brief: "Run a residency action (add, copy, move, clear, drop, load, repack); --draft.", summary: "Residency Model ACTION verb (ADD/COPY/MOVE/CLEAR/DROP/LOAD/CREATE) + `REPACK --source <bundle> --from <bag>`, the collect-the-residency export: the island re-renders a multi-tiddler bundle from its aside provenance through TW5's own serializer. `--draft <uri> [--to <bag>]` pulls a tiddler from a lower bag into a writable draft (no tombstone); a later ACTION verb lands it. Run `lares act` for usage.", handler: cmdAct, pathAccepts: (a) => a.flags["draft"] === true ? ["draft", "to"] : ACT_ROW.filter((n) => n !== "draft"), help: actHelpLines, verbs: ACT_VERBS, accepts: ["bag", "change-id", "draft", "dry-run", "from", "in-wiki", "out", "plane", "shadow", "source", "source-uri", "title", "to"] },
  { name: "ingest",        brief: "Scan disk into records through the Confluence gate; --watch per settle.", summary: "Disk→records through the Confluence gate: scan + diff (preview) or --apply through the island's INGEST verb. --tag-blobs stamps the CAS opt-in flag (`.meta` sidecar / meme ahu meta) for the large un-flagged carriers that would fault during LOAD/INGEST (preview names the count). `--watch` fires the same gesture per settle: one wave per quiet window (`--debounce ms`), preview by default, --apply submits; a vanished file tombstones nothing: the watcher hands it to the vessel's shore, where it stands pending until a person answers (`lares shore`).", handler: cmdIngest, pathAccepts: (a) => a.flags["watch"] === true ? ["watch", "apply", "debounce", "source", "to"] : INGEST_ROW.filter((n) => n !== "watch" && n !== "debounce"), verbs: null, accepts: ["apply", "change-id", "debounce", "in-wiki", "source", "tag-blobs", "to", "watch"] },
  { name: "export",        brief: "Carry authored memory out of the house before a re-founding.", summary: "Carry the operator's AUTHORED memory out of the house before a re-founding: `export <dest>` writes a bundle outside the house root and the workspace (the daemon mount's wiki working carriers, kāpae shadows and canon carriers, its kahua stage heads, draft recovery files, consented temp carriers, house-minted bags) with its roster (the re-declare list of pet-names, Handles and chair labels, and the share rows) sealed under the house's keep key (`<config>/keep-key`): faces ride by path key, never by a key or a face relation, and reads every byte back against its manifest. It waits for a settled projection: an unsettled carrier or a held save refuses by name unless `--accept-omissions` names the bundle partial, and the manifest records each omission. A face whose live stage will not read cuts with no flag: its files travel, its standing heads stay behind as a counted `face-unread` omission, and this terminal alone names the face. Sensoriums never travel (they survive where they stand), and neither does the daemon document or the control document.", handler: cmdExport, verbs: null, accepts: ["accept-omissions"] },
  { name: "import",        brief: "Carry an exported bundle back in after a re-founding.", summary: "Carry an exported bundle back in after a re-founding: `import <dest>` verifies every hash and path before anything moves, then previews; `--apply` replays the re-declare list as fresh acts, maps each bundle face to the ONE face here that carries its pet-name (none or two refuse by name), re-pours working and face canon rows through the ingest gesture (a diverged id stands off, never overwrites), re-lifts kahua heads under the new face's grant keyed by title and body digest, and lands draft and temp files where none stands. A journal under <root>/config lets an interrupted import re-enter to the same end; a second import lands nothing.", handler: cmdImport, verbs: null, accepts: ["apply"], signs: true /* re-lifts sign kahua acts under the face's grant */ },
  { name: "shore",         brief: "Answer the disk shore's standoffs and pending removals.", summary: "A person's answers at the disk shore. `lares shore` looks at the disk and lists what stands for a hand: each standoff (the disk and the records say different things, and nothing writes) with its key, and each pending removal (a file vanished where a base stands; nothing writes back and nothing tombstones). `shore take-records <uri> --key <key>` writes the records' render over one standoff's file; `shore take-disk <uri> --key <key>` lands that file's words in the records. A stand-off first loads the file's side as drafts in the worn face's draft layer, and the collapse rules the person set in their daemon face (`$:/config/lares/shore/collapse/<rule>`) settle what they can; what stays raises one alert naming `shore keep-disk` (the file's words whole), `shore keep-records`, and, where drafts stand, `shore keep-both` (the records take the file, the drafts stay) and `shore drafts <uri>` (the drafts by title). Every settling act runs on a person's hand at their own terminal: an AI seat's refuses `hand-act-only`, and `--yes` approves nothing by itself. `shore restore <uri>` writes a vanished file back; `shore remove <uri>` deletes the carrier in the wiki. Over more than one carrier, name the count that stands pending (`--all --count <n>`). An answer naming a state that moved takes nothing. `shore settle --bag <bag> --pending` resumes a settle word that stalled (no page settled within the stall window), over the carriers its record under the house's run dir names. `shore flush` writes what every island holds in memory to its mirrors (the daemon's with each lit face's, and every resident wiki's). `--face N` lists or answers a lit sibling's shore without wearing it.", handler: cmdShore, help: shoreHelpLines, verbs: SHORE_ACTS, accepts: ["all", "bag", "count", "face", "key", "pending", "yes"] },
  { name: "surface",       brief: "Keep each face's pool as one git working tree.", summary: "THE FACE POOL — one git working tree per face at projections/faces/<pet name>/. `surface init` makes the worn (or named, `--face N`) face's root a pool (.git at 0700, the house's ignore list, a local author `<pet name> <slug>@face.invalid`, a pre-commit pool-check hook) and says already on a second run; `surface check` refuses an index file or another face's root in the pool, a repo at projections/ or config/, and an author or signing key another face's pool carries; `surface open` prints `<editor> -n` over the face's root and its realm pools (`--launch` runs it; the editor reads from the house config tiddler `$:/config/lares/surface/Editor`, else `code`) and writes no workspace file; `surface commit [-m <seam>]` commits only what the house already agrees with, under a lar: subject naming no face, and never pushes. `--realm <realm pet name>` runs init, check and commit over the realm's one git tree at projections/realms/<realm pet name>/ (every wiki folder inside rides it; a tree nested below lifts in with its history kept) under the realm's identity `<pet name> <folded>@realm.invalid`, never a face's, and over each share row's workspace under its wiki's identity; a cabal of one's realm pool keeps no remote. It runs on this machine: with no LAR_ROOT it reads the container house's pools under LARES_HOUSE and asks the vessel only for a face no label settles (`surface face`).", handler: (args) => cmdSurface(args), verbs: SURFACE_VERBS, accepts: ["face", "launch", "message", "realm", "workspace"] },
  { name: "meme", brief: "Check, project, offer and promote meme carriers.", summary: "The meme door runs local normalize, check and sitting reads, projects carriers, and carries offers and hand promotion. Store-backed verbs require `(--recipe <slug> | --bag <slug>)`. Family put, patch, list and delete enter through tiddler --meme.", handler: cmdMemeSurface, pathAccepts: (a) => a.positional[0] === "offer" && a.positional[1] === "show" ? (a.positional[2] ? ["nexus"] : ["bag", "all", "after", "limit", "nexus"]) : null, verbs: MEME_VERBS, accepts: ["after", "all", "approval", "bag", "check", "dest-bag", "dialect", "edges", "face", "format", "from-bag", "gradient", "grammar", "limit", "nexus", "out", "over-fresher", "realm", "recipe", "root", "sitting", "target", "to", "tongue"] },
  { name: "bag",           brief: "Inspect and manage bags; wiki pin controls residency.", summary: "Inspect bags with show; use `wiki pin <url> --bag [--release]` for residency and `wiki status` for its overview.",      handler: cmdBag, pathAccepts: (a) => a.positional[0] === "show" ? (a.positional[1] ? ["dir"] : ["dir", "after", "limit"]) : a.positional[0] === "list" ? null : null, help: bagHelpLines, verbs: BAG_VERBS, accepts: ["bag", "rotate", "all", "after", "limit", "approve", "dir", "dry-run", "face", "fetch", "held", "holder", "home", "list", "note", "pin", "read", "read-remove", "reason", "release", "remove", "repo", "role", "root", "sweep", "tier", "to", "vcs", "write", "write-remove", "workspace"] },
  { name: "events",        brief: "Read the vessel journal (bag-projected entries).", summary: "Read the vessel journal: `bag-projected` entries, optionally from a cursor and with wait-on-next-entry.", handler: cmdEvents, verbs: null, accepts: ["kind", "since", "wait"] },
  { name: "realm",         brief: "Rename realms and move wikis between them (local pet names).", summary: "THE REALM'S PET NAME — a realm holds its wikis on disk at projections/realms/<realm pet name>/wikis/<slug>/ and its domain bags at projections/realms/<realm pet name>/bags/<slug>/, as a face holds its planes under projections/faces/<pet name>/. Every realm carries a pet name: one minted with none takes its wiki's slug (projections/realms/<slug>/wikis/<slug>/), and the vessel mints that label on first read, so nothing waits. The label rests local (projections/realm-labels/<pet>.json, 0600): never a share row, never a replicated document. `realm rename <current pet> --to <new pet>` renames a realm (path-safe, unique without case, never a face's pet name); `realm move <wiki slug> --to <realm pet>` moves a wiki and its canon bag into that realm (named now where none wears the pet name), keeping its canon realm id, and drops a label the move empties. Each moves the folder (its .git with it) at once while no vessel answers, else at the vessel's next lock or re-stand, never half-moved. `realm list` reads every realm back; `lares wiki init <slug> --realm <pet>` mints a wiki into an existing realm.", handler: (args) => cmdRealm(args), verbs: REALM_VERBS, accepts: ["to"] },
  { name: "wiki",          brief: "Switch, pin and inspect wikis; run engine verbs.", summary: "Use `wiki pin <subject> [--bag|--rotate] [--release]`, `wiki switch <slug> [--next-boot]`, and `wiki status [--recipe <slug>]`. Filter, render and act run in a wiki engine; `wiki render <filter> --recipe <slug> --output workbench [--filename <filter>] [--overwrite]` lands native render output in the wiki's bound workbench (rendered/).", handler: cmdWiki, pathAccepts: (a) => a.positional[0] === "act" ? ["recipe", "expected", "resulting", "face"] : a.positional[0] === "pin" ? (a.flags["bag"] ? (a.flags["release"] ? ["bag", "release"] : ["bag", "release", "reason"]) : ["bag", "rotate", "release"]) : a.positional[0] === "switch" ? ["next-boot"] : a.positional[0] === "render" ? (a.options["output"] === "workbench" ? ["recipe", "output", "filename", "type", "template", "variables", "overwrite", "face"] : ["recipe", "text", "form", "type", "max-bytes", "after", "target", "face", "bag"]) : a.positional[0] === "filter" ? ["recipe", "fields", "collapse", "limit", "max-bytes", "after", "all", "target", "face", "bag"] : a.positional[0] === "status" ? ["recipe", "target", "face", "bag", "realm"] : null, verbs: WIKI_VERBS, accepts: ["reason", "rotate", "release", "next-boot", "after", "all", "bag", "collapse", "count", "days", "dry-run", "expected", "face", "fields", "filename", "force", "form", "limit", "list", "max-bytes", "note", "output", "overwrite", "read", "read-remove", "realm", "recipe", "remove", "resulting", "target", "template", "text", "type", "variables", "write", "write-remove", "workspace"], help: wikiHelpLines },
  { name: "law",           brief: "Read the law index, pinned law first; pin and unpin law memes.", summary: "THE LAW INDEX \u2014 `lares law list [--limit N] [--after <cursor>] [--all]` reads the house's law from the worn face's daemon wiki, derived from canon by filter and never listed by hand: the pinned titles first (the boot seed, then the Mu family), then every root meme under a bag's api/ tree by title, each with its one line (description, else role). Only canon prints: a row stands where a canon layer answers its record, so nothing a face writes reads as law. The pin set rests in the wiki as $:/config/lares/law/pins; `lares law pin <uri>` and `lares law unpin <uri>` edit it by one run and land it in the face's working layer, never in house canon, and a pin orders canon law and adds none. The list prints plainly; --json carries {filter, pinsTitle, pins, rows, total, next}, the body the MCP seat's law_index answers.", handler: cmdLaw, verbs: LAW_VERBS, accepts: ["after", "all", "face", "limit"] },
  { name: "oracle",        brief: "Cast the I Ching by three coins; the cast lands as a tiddler.", summary: "THE ORACLE CAST — `lares oracle cast --recipe <slug> [--coins <six values>] [--caster <name>]` casts the I Ching by three coins a line (heads three, tails two: 6 old yin and 9 old yang change, 7 and 8 hold) and the vessel writes the cast once as a tiddler under lar:///ha.ka.ba/lares/oracle/casts/ (method, entropy, lines, changing, primary and relating hexagrams by King Wen number, caster, cast-at, readings); reading it again never casts again. With no --coins the coins draw through the platform's entropy door (crypto.getRandomValues); --coins hands in the six values the operator threw with real coins, bottom line first, named operator:three-coins. The command reads the time once; the verb reads no clock. It prints the reading plainly, with the house's imported DOA and e-jing texts for each hexagram and their attribution and license; --json carries the verb's answer, and the cast stands as a blind throw to collide uncertainty with: the throw stands, the reading stays open.", handler: cmdOracle, verbs: CAST_DOOR_VERBS, accepts: ["bag", "caster", "coins", "face", "realm", "recipe"] },
  { name: "tiddler",       brief: "Read, patch and remove records and meme families.", summary: "THE TIDDLER DOOR — `get <title> --meme` reads a carrier; `get --meme` lists family roots; `put <uri> --meme --file <path> | --text <words>` lands a family; `put <uri> --meme --slot <slot> --append <path> | --text <words> | --file <path> --base <hash>` appends to or replaces a slot; `delete <uri> --meme` removes a carrier family; `rename <old> <new> --recipe default [--if-match <hash>]` moves a record (a meme root with its slots) over TiddlyWiki's own relink and leaves the old title as a forwarder pointer. Without `--meme`, `put --file <host path | ->` reads text from a host file or stdin, `put --append <host path | ->` lands words at the end of a record's text with no base, put patches record fields and tags, and delete removes a record (`--family` names a record-family consequence).", handler: cmdTiddler, pathAccepts: tiddlerPath, verbs: TIDDLER_VERBS, accepts: ["after", "all", "append", "bag", "base", "create", "face", "family", "fields", "file", "if-match", "max-bytes", "meme", "mode", "realm", "recipe", "skinny", "slot", "tag-add", "tag-remove", "target", "text", "tree", "unset"] },
  { name: "repo",          brief: "Tend this checkout's reality tunnel and seat.", summary: "THE CHECKOUT'S DOOR — the checkout holds its declared reality tunnel (lar:///ha.ka.ba/lares/cli/reality-tunnel): the seed's links and imports, the scouts, the hosts' repo files. `read` answers both diffs and writes nothing; `tend` converges and writes only on difference; `verify` reads what the hosts loaded; `undo [gen]` restores a generation. Writes this checkout alone.", handler: cmdRepo, verbs: TUNNEL_VERBS, accepts: ["brief", "familiar", "force", "probe", "staged"] },
  { name: "home",          brief: "Tend each home's reality tunnel (seats, hooks, seed rule).", summary: "THE OPERATOR'S HOMES' DOOR — `--familiar <pet-name>` names the familiar whose hooks a tend seats (its wake, round, true-up), the pet name riding each hook as its argument; a tend naming none keeps the one seated. every home the device carries (the native home, and the Windows profile under WSL) holds its declared reality tunnel: the memory guards that keep every harness's sessions, the lares seats and hooks, the seed rule, `lares` on the path. `read` · `tend` (asks before writing; --yes without a terminal) · `verify` · `undo [gen]` (the operator's hand alone: an AI seat refuses by name; asks before restoring; --yes without a terminal). Writes the homes alone.", handler: cmdHome, verbs: TUNNEL_VERBS, accepts: ["brief", "familiar", "force", "probe", "staged"] },
  { name: "sense",         brief: "Search and read the sovereign sensorium.", summary: "THE SOVEREIGN SENSORIUM'S ONE DOOR (the guest comparator lives at `lares mempalace`). Addressed: `lares sense <sensorium> <verb>` targets any sensorium by name; bare `lares sense <verb>` keeps the `memory` default. READ — four verbs, the PLANE as a parameter: `search` (hybrid recall) · `relate` (bitemporal KG) · `structure` (entity-pair hallways) · `status` (wings/rooms/entities/total); `--lens <content|structure|form|persistence>` picks the plane (default content). One verb reaches any plane; a new plane needs no new verb. ANALYZE — `analyze --lens <lens>` runs every read instrument through one verb, the lens choosing which. Five read the poured sensorium: changes (where the content changes hands) · rhythm (the landed regimes) · couple (do coupled peers reconcile; also ki) · cohere (do the planes glue; also li) · square (do a child-host's lobes round-trip to one self). Three read a signal matrix the caller hands in with --signal: lead (who leads whom, the R reference) · forecast (does a regime shift approach) · mismatch (do couple and lead agree). Bare `analyze` lists the lenses; every answer names the lens it applied. `plane-record` (ONE cid → its presence across content · structure · form, honest nulls where a plane lacks it). STAND — `setup` (the sovereign organs; it left the boot, so standing them takes its own act). FEED — `capture` (one native source, the hook's own verb) · `pour` (`pour --all` walks the whole tending movement: quiesce, baseline, drawers, bearing, projection, verify, resume; `pour --bulk` runs the drawers leg alone, every transcript in one pass; `pour --writeback` runs the bearing leg alone) · `refresh` (re-derive the projection alone) · `meta` (tune the annotators) · `recall` (filtered verbatim drawers). HOLDERS — `quiesce` · `resume` · `holders` (the topology, and whether this vessel's daemon socket answers) · `teardown` (clean tear for a re-pave). DURABLE LIFECYCLE, direct over manifest.json — `roster` (every sensorium; `roster <name>` one sensorium's facets) · `build` · `reconcile` read and re-settle; `harden` · `retire` · `un-retire` · `purge` seat HITL and need --approve. WALK — `worldline` (the spirit tree) · `telemetry` (project lar_* gradients). Rides the daemon's composed caps (the single-owner law). Frozen trial: `trial-run` supervises one receipt-bearing operation; `search/status --trial-root` reads its owned Content and frontiers.", handler: cmdSense, pathAccepts: sensePathAccepts, verbs: SENSE_VERBS, leads: "<sensorium>", accepts: ["agent", "all", "all-strata", "approve", "as-of", "bulk", "channel", "confirm", "device", "drain", "dry-run", "ephemeral", "force", "freeze-receipt", "function", "grounds", "halves", "hold", "imago", "intent", "k", "keep-hooks", "lens", "limit", "list", "min-count", "model-home", "names", "not-root", "pair", "palace", "project", "reason", "repour", "revision", "room", "self-weight", "sensorium-root", "session-id", "signal", "source-host", "source-key", "span", "speaker", "spectral", "store-swap", "surface", "trial-root", "wing", "writeback"] },
  { name: "flow",          brief: "Run pet-named composed flows (crystal, rhythm, couple).", summary: "THE PET-NAMED COMPOSED-FLOW SURFACE (the anti-verb-sprawl door). One verb, N flows: the low-level instruments (crystallize · phase · whiten · couple · gate · mismatch) become the building blocks a FLOW composes, never the surface. Bare `lares flow` lists the flow-set (crystal · rhythm · couple) with their cap-stacks; `lares flow <petname> --signal <ndjson> [--names a,b,c] [--target <uri>]` runs one — the daemon looks its cap-stack up and runs each step routed by hull (crystallize/couple TS · phase py · mismatch daemon), threading each outcome to the next. New capability arrives as a new flow, never another raw verb. The signal rides --signal; auto-extraction from a poured target stands OWED.", handler: cmdFlowRun, verbs: null, accepts: ["names", "signal", "target"] },
  { name: "ddate",         brief: "Print the Discordian date (the house's own calendar; no vessel).", summary: "THE DISCORDIAN CALENDAR — `lares ddate [+FORMAT] [day month year]` prints the day in the Discordian calendar (five seasons of 73 days, the five-day week, St. Tib's Day on February 29, the holydays on days 5 and 50, YOLD = year + 1166), computed by the house's own isomorphic core, so a machine with no ddate binary reads it all the same. With no date it reads today's local day; the format codes follow ddate(1): %A %a %B %b %d %e %H %N %n %t %Y %. %X %{ %}, with %E added (the ordinal by its last digit alone, the first ddate's 11st). %X counts the days to X-Day (Confusion 40, 9827 YOLD), the date the Church of the SubGenius moved from 1998 once it passed without incident. %. draws one exclamation through the platform's entropy door (crypto.getRandomValues; `--json` names the source in data.entropy; the default answers the bare line and `--json` the envelope). Runs on the host and needs no vessel.", handler: cmdDdate, verbs: null, accepts: [] },
  { name: "mempalace",     brief: "The guest comparator: setup, harvest, repave, status.", summary: "THE GUEST COMPARATOR'S DOOR (the sovereign sensorium lives at `lares sense`). `setup` raises the guest ~/.mempalace; `harvest` mines vanilla transcript drawers into it only — no lar_* stamps, no live capture, the clean comparator; `repave` previews or rebuilds it; `status` / `quiesce` / `resume` observe and control live holders and hooks.", handler: cmdMempalace, passesThrough: (a) => a.positional[0] !== undefined && !MEMPALACE_OWN_VERBS.includes(a.positional[0]), verbs: MEMPALACE_OWN_VERBS, accepts: ["confirm", "dry-run", "help-mempalace", "hold", "keep-hooks", "project", "wing"] },
  { name: "spirit",        brief: "Wake, true and fold a spirit's record by its pet name.", summary: "A SPIRIT'S RECORD, BY ITS PET NAME — the name resolves `familiar/<pet>` or `spirit/<pet>` on the worn face's memory stage (both standing refuses `spirit-ambiguous`), and a stable `spirit-id` keys its residue. `om <pet> [--source startup|resume|clear|compact|fork|precompact] [--body <session>] [--held] [--title <session title>]` reads the card (each familiar its own: a held session (`--held`, its own counter names this pet) never switches, and its title reads as an offer or as this familiar's rename; a fresh body's title wakes the familiar whose record stands under its slug, and a startup's title no record answers prints that familiar's starter as an offer, never the seated card; a fork's title counts only where its record stands; with no `--body`, the title turns the wake only where its record names it as its own) under the 9,000-char wake cap: the skinny, #/open, the titles #/attention names, and the latest carry as testimony (a record moved since it read, a deep chain, a fork); a resume reads one line, a fork wakes framed as a fork, a precompact marks the crossing; `--body` joins the presence on the card's sibling record `presence/<pet>` (outside the card's render, so no wake moves its base; many bodies may wear one pet, and none locks another out; om names each sibling awake and each live body's last carry, and hands back each slot's digest), refreshed at wakes only, and stamps a wake epoch, an ordering stamp only; with no record, om prints a starter shrine. A SPIRIT READS AS A FOLDED CARRIER THE WIKI RENDERS: om and hum send the wiki one `<<spirit-unfold>>` call and print the shrine in the carrier's own grammar, as the file rests on disk, each folded slot standing as its `has` line and the one command that fetches it, by `--aperture <pulse|beat|measure|arc|theme | 0..20 | 10/measure>`: every slot folded at pulse (hum's own), the entry slot unfolded at beat, the attention and open slots at measure (om's own), measure plus #/bodies at arc (the spirit's lineage across turns), the whole carrier at theme; `--face` rides each command. A wake's testimony and doors ride past the carrier's release, so the whole text passes `lares meme check`; a wake's carrier past the cap folds one grain narrower and rides whole, and an aperture a hand names reads past the cap. A card with no shrine (`spirit-card/<pet>`) answers as a carrier too, its fields in the meta and its template transclusion beside the command that renders it; a wiki whose house skin holds no fold reads as before and names the read that shows it. `ah <pet> --slot '#/x' --file <path|-> | --text <words> | --add <line> [--base <hash>] [--epoch <n>]` trues one slot through the meme door, refusing growth only past the waking slots' caps (`spirit-slot-over-budget`: #/open 2,048 bytes, #/attention 1,024; every other slot and the record's total advise through hum and om) and ( `spirit-crossing` for a body (`--body`) inside its own compaction crossing, an advisory mark only the PreCompact hook sets, while siblings write on, each naming its cure); concurrent writes merge: `--add` appends past a sibling's write, and a whole-slot replace names the slot digest it read (`--base <slot digest>`, required of an AI seat, `spirit-base-needed`; om and ah hand digests back), and where the slot moved since lands both versions in a conflict stanza naming this writer and the slot's last writer, for hum to settle; `ah <pet> --new --file -` lands a first shrine once (`spirit-exists` where one stands). A CARD ALONE (`spirit-card/<pet>`, metadata as fields) answers om, ah and hum through its fields: `#/<name>` trues the card's field `<name>` under its live hash (its identity fields refuse `spirit-slot-held`). THE ʻĀLANA CIRCLE: `ah <pet> --offer [--file <path|-> | --text <words>] [--lane <memory uri>] [--grant <slice>]` lands the offering (ʻālana: the mandate, the card's own lane where no words ride, its sha256, the lane's memory pointer, the grant's slice) and its offerer (`hand`, or `seat#<body>`: a seat names `--body`) on the shelf `alana/<pet>` before any body wakes, each offering minting the next seq; an offering carries no authority beyond a nudge, so a re-offer over a standing mandate lands only from its offerer or a hand (`spirit-offer-held`), and a shelf whose hash disagrees with its words fails closed (`spirit-offering-damaged`); a body's om hands back the mandate and its hash (hoʻāla), and `ah <pet> --echo <hash> --body <id>` echoes it onto the sibling record as `<pet>#<body> <hash> <seq>` (`spirit-echo-mismatch` for another hash, `spirit-unoffered` with no offering); under an offering a slot write (ah, hum's fold) from a body that has not echoed the standing mandate, or from a seat naming no body, lands and carries an `unechoed: <pet>#<body> has not read mandate <hash>` notice, om names it too, and echoes stay as lineage (a receipt, never a gate; a person's hand, by the hand gate's reading, writes clean); the card's frame (lane model feeds wave waits) stays the hand's. `hum <pet>` (what remains after the fold) measures each slot, `--fold '#/x'` numbers its lines with each line's digest, and `--line <n> --expect <digest>` folds that line (wherever a sibling's write moved it; `spirit-fold-gone` where none reads the digest) and then burns it to the month's ash ledger, retrying, and returning the line to the slot where the ledger keeps refusing. `" + COMPACTION_WORD + " <pet> --file -|--text [--body <session>]` lands a compaction summary, the carry (" + COMPACTION_DISPLAY + "), as `" + COMPACTION_WORD + "/<spirit-id>-<hash12>` with its lineage after the strict secret-shape guard reads it whole; it writes nothing to the card and hands back the #/bodies line the next body files. `residue <pet> --text|--file [--key <session:agent>]` lands a spirit's handback once per key. `otakiage <pet>` writes the ash lines ahead, then burns the residue the last distill mark covers and no link reaches, keeping the card, on a person's hand alone (an AI seat refuses `hand-act-only`).", handler: cmdSpirit, verbs: SPIRIT_VERBS, accepts: ["add", "aperture", "base", "body", "echo", "expect", "face", "file", "fold", "grant", "held", "key", "lane", "line", "new", "offer", "slot", "source", "text", "title"] },
  { name: "hooks",         brief: "Pause, resume and read the capture hooks' lever.", summary: "The hook-lever: `pause` / `resume` / `status` capture hooks (a marker file a capture hook steps aside on when paused). Lets a migration/teardown run WITHOUT daemon-spawn contention. `lares mempalace quiesce` pauses AND drains; this carries the lever alone.", handler: cmdHooks, verbs: HOOKS_VERBS, accepts: ["reason"] },
  { name: "mcp",           brief: "Hold a client's MCP seat steady across the surface's restarts.", summary: "THE AHO — `lares mcp aho` holds an MCP client's stdio for the session's whole life and spawns the house's own surface as a child that may fall and rise, resolved again at each spawn (the container's seat where the container house stands, else the native one); `lares mcp aho -- <child argv…>` names another child. The client never sees a respawn: the seat answers `initialize` and the tool list from what the child last answered, replays the handshake to each new child itself, answers `hearth-sleeps` for a call that arrives while no child stands and `outcome-unknown: re-read before re-trying` for one in flight at a death (never sent again), and sends one `list_changed` when a new child lists other tools. It logs event names and counts alone and holds no key. A harness config records `lares mcp aho` and nothing beneath it (`lares home tend` writes that entry), so what stands under the verb may change with no config rewritten.", handler: cmdMcp, verbs: MCP_VERBS, accepts: [], passesThrough: () => true },
  { name: "sensorium",     brief: "Ingest, query and name source-neutral sensoriums.", summary: "The source-neutral sensorium surface: `run` / `open` ingest a path into an ephemeral sensorium; `query` / `ls` / `keep` / `dissolve` tend its lifecycle; `name`, `propose-name`, `names`, and `accept-name` attach or review local labels over a discovered cap-stack. Run `lares sensorium help`.", handler: cmdSensorium, verbs: SENSORIUM_VERBS, accepts: ["all", "evidence", "keep", "name", "orphans", "projection"] },
  { name: "vault",         brief: "Unlock, lock and bind the vessel key's custody.", summary: "The VESSEL KEY custody door. The vessel key seals the vessel's private rows (the keyhive and veil archives among them), and every boot rests at the floor until a person unlocks it: `unlock` opens the key on a TTY credential \u00b7 `lock` drops it \u00b7 `bind [--passphrase|--paper]` adds a slot \u00b7 `unbind <slot-id> [--rotate]` removes one, and with --rotate moves the key itself in the same act \u00b7 `status` shows the slot tree, each face, the carrier counts, every fault by name and any private file outside the carrier table, in prose on a terminal and through a pipe alike; `--verbose` adds one reading of each standing file, and `--json` answers the whole custody object. `backup --face <N> --out <file>` cuts ONE face's backup bundle through the standing vessel, sealed under a new route of its own: the face's root, its own lines and the content keys this vessel holds for it, and no veil key or seat. `restore <file> [--as <N>]` brings a face back from its bundle as a recovery act: this vessel derives its own veil and takes a NEW seat under the face's fixed prefix; `restore <file> --memory` lands the bundle's content keys on that seat. `rehive --face <N>` stands a SHUT face's hive again from its own seed where its veil-archive row holds another identity's Archive: the foreign row moves aside (never deleted), and the answer names what was lost and the acts that come next. `recard --face <N>` lights a face whose Archive fell behind its own cards (its light refused `FaceHoldsNoPrekeySecret`) under its own identity: its card mints before its bags and its Archive rests after that card; content a peer sealed to a lost prekey stays unreadable, by name. A credential rides a TTY alone: no flag, environment variable or pipe carries one.", handler: cmdVault, verbs: VAULT_VERBS, accepts: ["accept-loss", "all", "as", "cards", "face", "memory", "out", "paper", "passphrase", "rotate", "verbose"], signs: true /* holds and rotates persona key material */ },
  { name: "wear",          brief: "Wear a face already standing open; asks no route.", summary: "UNLOCK OPENS CUSTODY; WEAR CHOOSES THE FACE. `lares wear <N>` (or `--face N`) moves the vessel's mount to face hN, a face already standing open (under a pūlama, one the pūlama lends), and the vessel composes again on it. It asks no route and carries none: a wear is no ward act, and an AI seat wears on the operator's word. A vessel holding no key refuses `custody-locked` and names `lares vault unlock`; a face shut refuses `face-not-open`, one outside the lend `face-not-lent`; a composition that refuses wears the face it left and the vessel key stays held. A wear that turns the face flushes every shore first, inside the vessel, and prints what each island wrote; where records stay unwritten it refuses `shore-unwritten` and names them (a terminal asks; `--yes` turns anyway).", handler: cmdWear, verbs: null, accepts: ["face", "yes", "accept-loss"] },
  { name: "library",       brief: "Keep the acquired shelf of books and corpora, verifiable.", summary: "The ACQUIRED shelf — books and corpora a human did not author, kept READABLE and VERIFIABLE outside every tracked tree. `bags/` carries what an operator authors and round-trips; an acquired body has no author here and no parse∘render fixed point, so left on the seed surface it enters git history and a growing shelf grows the history with it. The tier stands at `<root>/library` (or LAR_LIBRARY), beside the hearth and never inside it, so no re-founding reaches it and acquired bytes never depend on runtime records. Layout: `<collection>/<cid>/<the real filename>` — the directory name IS the digest (audit with sha256sum, no tooling), the filename reads to a human; no per-entry sidecar — each entry's record rides as its own `#/<cid>` ahu slot inside the collection's `index.mem` carrier, carrying origin + licence + the RFC-6920 anchor. `list` · `show <coll>` · `acquire <file> --to <coll>` (MOVES by default — moving carries the point; --keep copies) · `verify` (re-digests BYTES, never records) · `index <coll> --out <path>` (the tracked part that travels) · `path <coll>`. A reference NAMES: `library:mark-twain` travels, a directory does not.", handler: cmdLibrary, verbs: LIBRARY_VERBS, accepts: ["keep", "licence", "license", "note", "origin", "out", "to"] },
  { name: "persona",       brief: "Mint, name and stand persona roots; sign a raise challenge.", summary: "The PLURALITY-PONO identity multitude. `new <index> --name '<petname>'` mints/loads a persona root; `--handle '<Handle>'` independently declares its outward name; `--seat [--chair <label>]` stands it for a Kahu chair on THIS node, needs no Handle and carries a private chair label; `--split-root` opts into the 2-of-3 recovery split. `list` prints held indices, labels, Handles and local chair labels; `sync` carries labels and Handles to the operator's own fleet while seat claims stay local; `reissue [--nexus <aid>] [--face N]` hands the face's key at one Nexus on to a fresh random key by a hand-over both keys sign, which the Nexus's gates read beside the face's admit. `recovery-contact show <index>` prints a face's prefix and its set; `recovery-contact offer --prefix <persona-…>` mints a recovery contact's fresh key for one face and prints its card and offer line; `recovery-contact enrol <index> --threshold <k> <offer>…` enrols the face's first recovery contact set by one typed event its own key signs, refusing a key another face holds. `provisional <index>` reads whether a restored face still waits on a party's view; `confirm <index> <lar-log-view:…>` confirms it by one party's own view; `view <persona-…> --seat-key <key>` signs a chair's view of a face's head; `recovery-contact view --prefix <persona-…>` signs a recovery contact's own view with its card. `raise-sign <challenge-json> [--as <index>]` is the RECOGNISER's half of the raise ceremony: it signs a vessel's raise challenge with one of YOUR persona leaves and hands back a grant (the caps that arrive ride YOUR key, and the grant stands only until that Nexus's lease epoch rolls past it).", handler: cmdPersona, pathAccepts: (a) => a.positional[0] === "raise-sign" ? ["as"] : PERSONA_ROW.filter((n) => n !== "as"), verbs: PERSONA_VERBS, accepts: ["as", "chair", "face", "handle", "name", "nexus", "prefix", "seat", "seat-key", "split-root", "threshold"], signs: true /* mints persona roots */ },
  { name: "circle",        brief: "Follow and unfollow nyms in your circles.", summary: "The FOLLOW VERB — the INVERSION-OF-CONTROL social graph. `add <nym> --to <circle> [--petname <label>] [--card <file>]` recognises a nym (already-known, or TOFU-admits a carried self-certifying HandleCard) + optionally sets its PRIVATE local label + adds it to the circle (adding to a circle IS the follow); `remove <nym> --to <circle>` unfollows; `list [--to <circle>]` reads the private follow-view (petname + last-seen glamour). The graph stays PRIVATE and LOCAL — nothing reaches the crossroads plane, no central trace. Publishing a public glamour stays a separate, deliberate act. Fail-closed: following an unmet nym needs `--card`.", handler: cmdCircle, verbs: CIRCLE_VERBS, accepts: ["card", "face", "petname", "to"] },
  { name: "cabal",         brief: "Vouch for joiners and manage cabal-realm relations.", summary: "The JOIN AXIS — a mutual-hold relation with a cabal-realm, orthogonal to the CARRIAGE contract `nexus contract` writes. `cabal vouch <joiner-nym> --realm <realm-doc-id>` stakes the acting face's (`--face N`) OWN standing on one joiner, signed with the key that face presents at the Nexus the realm stands under, onto the realm's own vouch board — no kahu quorum, because a vouch stakes one hand's own standing rather than performing a steward act. It ADMITS NOBODY: a vouch rides as signal-2 on the lineage the admission price walks, and the cost lands at the moment of vouching, since a voucher's score SPLITS across everyone they vouch for. Re-vouching the same joiner stays ONE edge — re-minting never buys out-degree.", handler: cmdCabal, verbs: CABAL_VERBS, accepts: ["applicant", "bundle", "cap", "face", "nexus", "realm"], signs: true /* a vouch STAKES the voucher's own standing */ },
  { name: "edge",          brief: "Set a relationship aside (kapae) or take the marker down.", summary: "Set one RELATIONSHIP aside, or take the marker back down \u2014 the k\u0101pae raised over an EDGE rather than over a party. `edge kapae` shadows a relation and `edge un-kapae` re-admits it as a deliberate signed act; name the relation by `<edge-id>`, by `--member <key> --realm <id>`, or by `--device <key>`. Two hands act: the HOLDER the edge names (a voucher over a vouch, a fleet root over a device) and, with `--quorum`, the seat quorum of the charter the realm stands under. A lower lifts only its own hand's raises, and a raise wins a tie, so a removal never quietly reverses when a partition heals. The write asserts no authority: whether a hand holds the edge gets decided by whichever reader consults the shadow. `edge settle` answers each counted raise on the key side: the seat a raise names leaves the face's key group. With `--quorum --partial` a vessel that holds fewer seats than an act takes signs its part and prints a partial, and `edge cosign` adds another vessel's seats and lands the act once it counts.", handler: cmdEdge, verbs: EDGE_VERBS, accepts: ["as", "face", "realm", "nexus", "member", "device", "quorum", "fleet", "partial", "voucher", "joiner", "from", "act"], signs: true /* a kapae act signs over a relationship */ },
  { name: "nexus",         brief: "Seal seats, charter epochs and the Nexus roster.", summary: "The Nexus founding-kahu ROSTER + its PRE-ROTATED charter-epoch chain (TUF≈KERI) — the Kapae immune antigen's authority home. `nexus seal seat` gives each persona that STANDS for a chair a seat key of its own (minted sealed on this vessel, apart from every persona root) + establishes the genesis epoch, which commits one digest per chair to that chair's NEXT key, printed once on a cold-key card the operator reads back; `nexus seal rotate` takes each chair's card back on a terminal + advances the chain (FAIL-CLOSED on a roll the law refuses); `nexus seal show` reads the roster, chain head, + quorum verdict; `nexus seal roll open|join|sign|file` rolls a joint Nexus across its vaults as one carried circle; `nexus seal cofound open|join|seal` founds a FRESH two-of-two Nexus with a second operator, files carried between the two vaults, each person typing the other seat's fingerprint as heard (neither household seed moves). `nexus kapae <nym> [--reason]` RAISES a quorum-signed ban onto the always-carried antigen board (a banned presenter draws Mu); `nexus kapae --list` folds the currently-Kapae'd set; `nexus un_kapae <nym>` mints a quorum-signed lift whose causal parents name the ban heads it answers, so it supersedes exactly the raises it read and never a raise it did not see (a concurrent raise and lift fold `unsettled`; FAIL-CLOSED: a sub-quorum or unseated charter REFUSES, writing nothing). `nexus contract <leaf> --sig <hex>` admits a joining operator's per-Nexus leaf and emits the carried admit BUNDLE (public bytes: the admit, its lineage, the Nexus, this hearth's gate bundle pin); where the Nexus's seats rest in two vaults, `nexus contract <leaf> --nexus <aid> --out <file>` signs with the seats held here and writes a PARTIAL, and the other vault's `nexus contract --from <partial>` judges it against its own head and board, cosigns and lands it; the joinee's `nexus admit-take <file>` verifies it offline against the charter she holds, keeps it, and her dial presents it at that hearth alone. A PLACE (a herm) joins a Nexus by hand: its own `nexus carry-for [--nexus <aid>] [--out <file>]` signs the carrier seal and its floor pin, a founding kahu's `nexus carry <place-key> --carrier <hex> [--floor-pin <file>]` counts it and emits the carry bundle, and the place's `nexus carry-take <file>` lands it; `nexus posture [private | open]` reads or flips the federation posture. `nexus approve open|sign|check` carries a promotion's seat approval of exact bytes between vaults as a file: `open` signs the file's hash with the seats held here, `sign --confirm-statement` adds another vault's seats once a person confirms the statement digest, `check` reads the verdict over the bytes. `nexus cabal admit|remove <group>` admits a PersonaGroup into the Kahu cabal at the seat quorum (a partial travels by `--out`, and `nexus cabal cosign <partial> --act <cid>` adds another vault's seats); `nexus cabal standing <group>` reads where it stands.", handler: cmdNexus, pathAccepts: (a) => a.positional[0] === "approve" ? (a.positional[1] === "open" ? ["purpose", "surface", "class", "nexus", "out"] : a.positional[1] === "sign" ? ["confirm-hash", "confirm-statement", "nexus", "out"] : a.positional[1] === "check" ? ["nexus"] : null) : null, verbs: NEXUS_VERBS, accepts: ["act", "added", "apply", "approval", "carrier", "carry", "charter", "charter-law", "class", "cold-key", "confirm-hash", "confirm-statement", "contract", "cosign", "cut", "edge", "expiry", "face", "floor-pin", "from", "heard", "heard-threshold", "index", "join", "list", "nexus", "note", "out", "purpose", "realm", "reason", "release", "sig", "source", "steward", "surface", "sync-url", "thin", "threshold", "tier", "with"], signs: true /* quorum-signs admits, kapae and charter acts */ },
  { name: "fleet",         brief: "Join a new vessel to one face's fleet with carried files.", summary: "THE FLEET-JOIN DOOR — one face's fleet takes a new vessel of the same human, by three files carried by hand. `fleet join offer [--face N]` on the root holder (`--face` names which face, default 0); `fleet join request <offer>` on the joining place (its face-scoped keys mint there); `fleet join answer <request> [--doc-url URL]` on the root holder (the device edge, a certificate and a grant per scope, the signed gate pin and canon, the document the new vessel asks for, the face's sealed address secret); `fleet join land <answer>` on the joining place; `fleet join abandon` drops a pending join.", handler: cmdFleet, verbs: FLEET_VERBS, accepts: ["doc-url", "face", "out", "sync-url"], signs: true /* signs a device edge, certificates, grants and the answer */ },
  { name: "handle",        brief: "Publish and manage a persona's Handle.", summary: "The Handle's verb family — a persona's public \"here I am\" note, its lifecycle on the handle-KEL. `publish \"<glamour>\" [--persona <index>]` (LIVE) mints a self-certifying card and announces it onto the Nexus WHO board the relay syncs; the face ANCHORS to its persona (the persona-KEL prefix owns it), so a lost presentation key recovers THROUGH the persona and a vessel with no founded persona refuses rather than self-owns. `rotate` seats a fresh presentation key under the same name, `burn` ends it terminally (self · `--from-persona`), `attest \"<claim>\"` signs a claim under the current head, and `verify-attestation <statement> [--card <file>]` runs the RECOGNISER's half — a reader-local CHAIN-verify (the chain verifies, stands unburned, seats the head that signed) that touches no network: it proves THE HANDLE SAID IT, never that the claim is TRUE, and the SURFACE-verify (asking DNS) stays a separate act. `graft` declares its shape and awaits its vessel-side pass. This is the deliberate outward act `persona --handle` only DECLARES as intent — a separate cap, never folded into persona.", handler: cmdHandle, verbs: HANDLE_VERBS, accepts: ["card", "face", "from-persona", "glamour", "persona", "return-locator", "subject", "surface"], signs: true /* mints + signs a HandleCard */ },
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
const ACT_ROW     = { filter: (f: (n: string) => boolean) => rowOf("act").filter(f) };
const PERSONA_ROW = { filter: (f: (n: string) => boolean) => rowOf("persona").filter(f) };

/** The flags each tiddler sub-verb reads; `get` folds again by lens and grain (one door, read on a gradient). */
const TIDDLER_SUB_FLAGS: Readonly<Record<string, ReadonlySet<string>>> = {
  get: new Set(["after", "all", "bag", "face", "fields", "max-bytes", "meme", "realm", "recipe", "skinny", "slot", "target", "tree"]),
  put: new Set(["append", "bag", "base", "create", "face", "fields", "file", "meme", "realm", "recipe", "slot", "tag-add", "tag-remove", "target", "text", "unset"]),
  delete: new Set(["bag", "base", "face", "family", "if-match", "meme", "mode", "realm", "recipe", "target"]),
};
/**
 * `tiddler get` FOLDS BY LENS AND GRAIN: the meme lens reads no `--fields` or `--max-bytes` (it answers a carrier, paged on slot
 * boundaries); the record lens reads no `--after` (a record answers in one); a slot names one slot, which the meme's has-stack
 * (`--skinny`) and whole carrier (`--all`) do not read. A word that rides as a VALUE (a slot child's title beside `--all`, a seat's
 * wire args) refuses at the door itself (`read-word-unread`): one mechanism per kind.
 */
function tiddlerPath(a: ParsedArgs): readonly string[] | null {
  const sub = a.positional[0] ?? "";
  const flags = TIDDLER_SUB_FLAGS[sub];
  if (!flags) return null;
  const meme = a.flags["meme"] === true;
  const wide = a.flags["skinny"] === true || a.flags["all"] === true;
  const listing = sub === "get" && a.positional[1] === undefined && meme;
  const patch = sub === "put" && meme && (a.options["slot"] !== undefined || a.options["append"] !== undefined);
  return rowOf("tiddler").filter((n) => flags.has(n)
    && !(listing && !new Set(["after", "bag", "face", "meme", "realm", "recipe", "target", "tree"]).has(n))
    && !(sub === "get" && !listing && n === "tree")
    && !(sub === "put" && meme && new Set(["create", "fields", "tag-add", "tag-remove", "unset"]).has(n))
    && !(sub === "put" && meme && !patch && new Set(["append", "slot"]).has(n))
    && !(sub === "delete" && meme && new Set(["family", "mode"]).has(n))
    && !(meme && (n === "fields" || n === "max-bytes"))
    && !(!meme && n === "after")
    && !(meme && wide && n === "slot")
    && !(n === "tree" && (!meme || a.positional[0] !== "get" || a.positional[1] !== undefined))
    && !(a.positional[0] === "put" && n === "slot" && !meme)
    // A PLAIN APPEND OVERWRITES NOTHING: it names its words alone, so no whole text, no base and no field patch ride beside it.
    && !(sub === "put" && !meme && a.options["append"] !== undefined && new Set(["text", "file", "base", "fields", "unset"]).has(n)));
}

/**
 * Every top-level `lares` command name — the source the isomorphism fixture (cli-verbs.json) mirrors
 * and YIN's three-way parity test reads (CLI command-table ↔ MCP tool-set ↔ VERB_SEATS). Kept in sync
 * with COMMANDS by derivation, so a new verb here surfaces in the fixture the moment it regenerates.
 */
for (const c of COMMANDS) seatAbout(c.name, c.summary);

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
  const brief = (name: string, summary: string): string => {
    const row = COMMANDS.find((c) => c.name === name);
    return `${row?.brief ?? summary}${row?.signsOnly ? ` (✍ ${row.signsOnly.join(", ")} alone)` : ""}`;
  };
  // `law` took the blank under the title: the usage line follows it at once, so the list stays within 66 lines.
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
  // `oracle` took the blank after the last group: a blank parts two groups, and the footer follows the last one, so the
  // list stays within 66 lines.
  const listed = groups.map(([scope, title]) => [title, shown.filter((c) => commandScope(c.name) === scope)] as const).filter(([, rows]) => rows.length > 0);
  listed.forEach(([title, rows], at) => {
    console.log(`${title}:`);
    for (const c of rows) console.log(`  ${c.signs ? "✍ " : "  "}${c.name.padEnd(13)} ${brief(c.name, c.summary)}`);
    if (at < listed.length - 1) console.log("");
  });
  // `realm` took the second footer line: the house and the path spelling share one, so the list stays within 66 lines.
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
  { argv: ["watch"], to: "lares ingest --watch" },
  { argv: ["draft"], to: "lares act --draft <uri>" },
  { argv: ["raise"], to: "lares persona raise-sign <challenge-json-text>" },
  { argv: ["wing-of"], to: "node tools/wing-of.mjs" },
  // Residency rides `wiki pin` and `wiki status`; the wiki's pointer rides `wiki switch` and `wiki pin --rotate`.
  { argv: ["bag", "pin"], to: "lares wiki pin <url> --bag" },
  { argv: ["bag", "unpin"], to: "lares wiki pin <url> --bag --release" },
  { argv: ["bag", "stats"], to: "lares wiki status" },
  { argv: ["bag", "list"], to: "lares bag show [<slug>]" },
  { argv: ["wiki", "open"], to: "lares wiki switch <slug> --next-boot" },
  { argv: ["wiki", "hold"], to: "lares wiki pin <slug> --rotate" },
  { argv: ["wiki", "release"], to: "lares wiki pin <slug> --rotate --release" },
  { argv: ["wiki", "unpin"], to: "lares wiki pin <slug> --release" },
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

export async function dispatch(rawArgv: readonly string[]): Promise<number> {
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
  // Global help: bare `lares`, `lares help`, or `lares --help` with no command.
  //
  // A NAME THAT DOES NOT ANSWER MUST NOT ANSWER SOFTLY. Routing an unknown command to the global menu
  // returns 0 and prints a full page, which reads exactly like a door that opened — so a caller probing
  // `lares <name> --help` cannot tell a live verb from a name no door answers, and the collapse's own law
  // (one spelling per door) stops being checkable from outside. The unknown-command refusal
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
  const moved = movedTo(args);
  if (moved) { console.error(`usage: this command moved to \`${moved}\``); return 2; }
  const cmd = COMMANDS.find((c) => c.name === args.command);
  if (!cmd) {
    // A SHIM VERB'S HELP: the host shim answers `up|down|reset|found|logs|build|rebuild`, and a help ask stays on this machine,
    // so the row reads here (`shimHelpLines`) instead of refusing a name the shim owns.
    const shim = args.flags["help"] ? shimHelpLines(args.command) : null;
    if (shim !== null) { for (const line of shim) console.log(line); return 0; }
    console.error(`lares: unknown command "${args.command}".  Run \`lares help\` for the list.`);
    return 2;
  }
  // Per-command help: `lares <command> --help` renders the command's own examples-first help and
  // returns — never running the handler. The command may ALSO render help on missing-args itself.
  // A SUB-DOOR answers for itself when the registry holds one (`lares vessel rite --help`), so a
  // sub-verb's flags reach the reader instead of its parent's.
  // `--meme` follows the door's help with the wiki record standing behind it, read through the one door
  // (`lares tiddler get --meme`) — the same verb any vessel with the cap can run.
  if (args.flags["help"]) {
    const door = helpDoor(cmd.name, args.positional);
    // A door that keeps its own sub-verb table answers with it where the registry holds no row: one table, two spellings.
    if (cmd.help !== undefined && !(door in COMMAND_HELP)) { for (const line of [...cmd.help(), "", "About:", `  ${cmd.summary}`]) console.log(line); return 0; }
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

export function runCli(): void {
  const argv = process.argv.slice(2);
  bridge(argv, COMMAND_NAMES).then((forwarded) => forwarded ?? dispatch(argv)).then(
    async (code) => {
      try { await drainStdout(); }
      catch (err) { console.error(err); process.exitCode = 1; return; }
      process.exitCode = code;
    },
    (err)  => { console.error(crashReading(err)); process.exitCode = houseRootUnnamed(err) ? HOUSE_ABSENT_EXIT : 1; },
  );
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
