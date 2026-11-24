/**
 * host-bridge — the host `lares` hands a vessel verb to the container house when no house root stands here.
 *
 * THE HOUSE ANSWERS FROM ONE PLACE. A host shell that names `LAR_ROOT` runs every verb in this process, against that
 * root, exactly as before. A host shell that names none, while the operator's container house stands
 * (`~/.lares/lares-surface.env`, the file `tools/lares-container.sh` and the MCP seat's resolver both read), FORWARDS
 * every vessel verb to the checkout's shim with the same argv: the shim execs the CLI inside the standing vessel, or
 * runs the offline door when none stands. No socket crosses the container wall; the daemon's UDS stays in the
 * vessel's own /tmp.
 *
 * HOST VERBS STAY HOME. `home` and `repo` edit this machine's homes and checkout; `help` and every `--help` render
 * from the table; `mempalace` tends the guest comparator in this home;
 * `meme normalize|check` and `meme project <file> --to md` run over a file with no daemon; `surface` keeps the face pools,
 * which rest on this disk, and asks the vessel only for the face no label settles. They never forward.
 *
 * NEVER INSIDE THE VESSEL. The image sets `LAR_ROOT=/lar` and `LARES_IN_CONTAINER=1`; either keeps the route local, so
 * a vessel whose environment lost its root refuses by name instead of looping (and the vessel holds neither the env
 * file, under its own HOME, nor the shim's docker). `/.dockerenv` reads nothing here: a CI job or a devcontainer that
 * drives docker stands in a container too, and it is a host.
 *
 * THE BRIDGE ADDS TWO CODES AND NO OTHER: {@link HOUSE_ABSENT_EXIT} (no root, no container house) and
 * {@link SHIM_ABSENT_EXIT} (the container house stands, its shim does not). Everything else returns the shim's own
 * code, and stdout passes through untouched, so `lares … --json | jq` reads the vessel's bytes. A credential verb with
 * no terminal refuses by name before docker runs ({@link CREDENTIAL_TTY_EXIT}, the usage code the CLI's own refusal
 * reads): the forwarder never runs it detached from a TTY.
 *
 * WINDOWS. Windows runs `lares` inside WSL first. A native PowerShell front-end, when one comes, calls
 * `wsl.exe lares …` with an argv array (no .cmd shim), and the house root stays on WSL ext4.
 */

import { locateShim, SHIM_ABSENT_EXIT } from "./shim-locate.js";
export { locateShim, SHIM_ABSENT_EXIT };
import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs, ArgsError, BOOLEAN_FLAGS, type ParsedArgs } from "./parse-args.js";
import { envValue, IN_CONTAINER_ENV, surfaceEnvPath } from "./surface-env.js";
import { ownPeerKind } from "@lararium/node";
type PeerKind = ReturnType<typeof ownPeerKind>;

export { envValue, IN_CONTAINER_ENV, surfaceEnvPath };

/** No house root here, and no container house stands to answer (sysexits EX_CONFIG). */
export const HOUSE_ABSENT_EXIT = 78;
/** The container house stands and the checkout's shim does not (sysexits EX_UNAVAILABLE). */
/** A credential verb with no terminal on both ends: the usage code the CLI's CredentialTtyRefusal reads. */
export const CREDENTIAL_TTY_EXIT = 2;

/** A host path in a forwarded argv that rests under no mount the container house binds. */
export const PATH_OUTSIDE_EXIT = 64;

/** The names the shim hands into the vessel by `-e NAME`: display and debug alone, never a credential. */
export const FORWARDED_ENV: readonly string[] = ["NO_COLOR", "TERM", "COLORTERM", "LARES_DEBUG"];


/**
 * THE SHIM'S OWN VERBS, each with the row `lares <verb> --help` reads: no CLI command answers them, and the shim does
 * (`tools/lares-container.sh`, whose header keeps the long account). A help ask stays on this machine (`asksHelp`), so the
 * dispatcher reads these rows where its own table holds none.
 */
const SHIM_VERB_HELP: Readonly<Record<string, { readonly usage: string; readonly about: readonly string[] }>> = {
  up:    { usage: "lares up [--capture <dir>]... [--workspace <name>=<dir>]...", about: ["Stand the vessel's container (detached) and wait until it answers healthy; then `vault unlock` on this terminal.", "A vessel stands holding no key: every start returns it to the floor until a person unlocks it."] },
  down:  { usage: "lares down [compose-down args]", about: ["Stop the vessel and remove its container; the house stays in LARES_HOUSE.", "It asks the standing vessel first what a stop would drop (`vessel census`) and refuses on any item until it settles or a person types `accept-loss`."] },
  reset: { usage: "lares reset", about: ["Clear a stopped vessel's hearth (LARES_HOUSE/hearth alone) after confirmation at a terminal.", "Sensoriums, projections, library and config stay."] },
  found: { usage: "lares found [vessel-found args]", about: ["The founding act, at a terminal: it gathers the human route (a passphrase and/or a paper pin); `--hearth` prints the seed card and reads it back.", "Run it before `up`: the act holds the store. `lares vessel found --help` names its flags."] },
  logs:  { usage: "lares logs [compose-logs args]", about: ["Read the vessel's log (`-f` follows it)."] },
  build: { usage: "lares build [compose-build args]", about: ["Rebuild the vessel image from the committed checkout and stamp HEAD as its revision label.", "A dirty checkout, or none, refuses: the label must name a real commit."] },
  pulama: { usage: "lares pulama light [--admit] | keeper-commit [<rev>] | keeper-land | status | lock | admit [face…] | …", about: ["The pūlama's hand verbs, on this terminal (the shim reads no route; the pūlama does). `light --admit` lights and admits the reported image under one route (the struck fire).", "`keeper-commit [<rev>]` names the keeper's successor: it prints the successor closure D′ and the source tree, offers the clean-tree re-check (tools/pulama-closure.mjs on a fresh archive), then the pūlama proves your route; the next `lares rite kukulu` then hands the living fire to it unattended.", "A wide kukulu lei with returns left on the line licenses that commit itself: a no-terminal `lares rite kukulu` rests it with no route, over a revision reachable from origin, green in CI, built into an image whose closure label matches, and the rite's own return spends on it; every face the vessel holds of one device."] },
  rebuild: { usage: "lares rebuild [--at <rev> | --prior] [--image]", about: ["The restand `lares rite kukulu` walks (run that one verb): the image of the revision (the tag, a kept image, or a build), then down (keep, census), the pūlama re-stood and lit on this terminal where its code moved or it stands unlit, up, its admit where owed, and the last face worn.", "It reads where the house stands each run, so a stopped run picks up from there; with no terminal, a light or admit owed stops it before anything moves. `--image` stops after the image and prints the reading."] },
};
export const SHIM_VERBS: ReadonlySet<string> = new Set(Object.keys(SHIM_VERB_HELP));

/** The help lines of one shim verb, or null for a name the shim does not own. */
export function shimHelpLines(verb: string): string[] | null {
  const row = SHIM_VERB_HELP[verb];
  if (row === undefined) return null;
  return [
    `usage: ${row.usage}`, "", ...row.about.map((l) => `  ${l}`), "",
    `  The host shim answers this verb (tools/lares-container.sh ${verb}); it runs on this machine, outside the vessel.`,
    "  The shim's own header keeps the full account of every verb it answers.",
  ];
}

/** Commands that run on this machine whole. */
const HOST_COMMANDS: ReadonlySet<string> = new Set(["home", "repo", "help", "ddate", "mempalace", "mcp", "surface"]);

/** Commands with some sub-verbs local and the rest in the vessel. */
const MIXED_COMMANDS: ReadonlySet<string> = new Set(["meme", "rite"]);

export type CommandScope = "host" | "vessel" | "mixed";

/** Where a command answers, as `lares --help` marks it. */
export function commandScope(name: string): CommandScope {
  if (HOST_COMMANDS.has(name)) return "host";
  if (MIXED_COMMANDS.has(name)) return "mixed";
  return "vessel";
}

export interface FsProbe { exists(path: string): boolean }

export interface RouteInput {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fsProbe: FsProbe;
  /** A terminal on stdin AND stdout: the shim attaches (`-t`) on the same reading. */
  readonly tty: boolean;
  /** The checkout's `tools/lares-container.sh`, or null when no checkout holds this CLI. */
  readonly shim: string | null;
  /** The CLI's command names: an unknown name stays local, where the dispatcher names it. */
  readonly commands: readonly string[];
}

export interface RouteError { readonly code: number; readonly lines: readonly string[] }
export type Route = "local" | "forward" | { readonly error: RouteError };


/** True when the argv asks for help or the version, in any spelling the CLI reads before `--`. */
function asksHelp(argv: readonly string[]): boolean {
  for (const tok of argv) {
    if (tok === "--") return false;
    if (tok === "--help" || tok === "-h" || tok === "--version") return true;
  }
  return false;
}

/** `meme`'s local seats: the file laws, and `project` over a file to md. */
function memeLocal(args: ParsedArgs): boolean {
  const sub = args.positional[0];
  if (sub === "normalize" || sub === "check") return true;
  if (sub !== "project") return false;
  const source = args.positional[1] ?? "";
  return !source.startsWith("lar:") && args.options["to"]?.trim() === "md";
}

/** A verb that reads a credential: it needs a terminal end to end. */
function readsCredential(args: ParsedArgs): boolean {
  const sub = args.positional[0];
  if (args.command === "found") return true;
  // A rehive reads the face's own route at the terminal (`vault rehive --face N`); a recard the face's own too (`vault recard --face N`; under a pūlama it asks none, the route proving at the pūlama's hand door).
  if (args.command === "vault") return sub === "unlock" || sub === "bind" || sub === "unbind" || sub === "rehive" || sub === "recard";
  if (args.command === "vessel") return sub === "found" || sub === "rotate";
  // A face founds under its own ward route, read at the terminal (`persona new N`, the face's custody born under it).
  if (args.command === "persona") return sub === "new";
  return false;
}

/**
 * Local, forward, or a named refusal — from argv, env and a file probe alone.
 */
export function decideRoute(input: RouteInput): Route {
  const { argv, env, fsProbe } = input;
  if ((env["LAR_ROOT"] ?? "").trim() !== "") return "local";
  if ((env[IN_CONTAINER_ENV] ?? "").trim() !== "") return "local";
  const head = argv[0];
  if (head === undefined || head.startsWith("-") || asksHelp(argv)) return "local";
  let args: ParsedArgs;
  try { args = parseArgs(argv); }
  catch (err) { if (err instanceof ArgsError) return "local"; throw err; }
  const name = args.command as string;
  if (!SHIM_VERBS.has(name)) {
    if (!input.commands.includes(name)) return "local";
    if (HOST_COMMANDS.has(name)) return "local";
    if (name === "meme" && memeLocal(args)) return "local";
    // kūkulu calls the shim, so it runs where the shim stands; its rows forward into the vessel. keep's host half runs git in
    // the operator's workspace clone the same way, and reaches its vessel half (`rite keep-cut`) as a row.
    if (name === "rite" && (args.positional[0] === "kukulu" || args.positional[0] === "kūkulu" || args.positional[0] === "keep")) return "local";
  }

  const envFile = surfaceEnvPath(env);
  const shimShown = input.shim ?? "tools/lares-container.sh";
  if (envFile === null || !fsProbe.exists(envFile)) {
    return { error: { code: HOUSE_ABSENT_EXIT, lines: [
      `lares: no house root: LAR_ROOT names none, and no container house stands (${envFile ?? "~/.lares/lares-surface.env"} stands absent)`,
      `lares: set LAR_ROOT to a host house root, or stand the container house: write ${envFile ?? "~/.lares/lares-surface.env"}, then run ${shimShown} up`,
    ] } };
  }
  if (input.shim === null || !fsProbe.exists(input.shim)) {
    return { error: { code: SHIM_ABSENT_EXIT, lines: [
      `lares: the container house stands (${envFile}), and its shim stands absent at ${shimShown}`,
      "lares: run lares from a checkout that holds tools/lares-container.sh, or set LAR_ROOT to a host house root",
    ] } };
  }
  if (readsCredential(args) && !input.tty) {
    const verb = [name, ...(name === "found" ? [] : [args.positional[0] ?? ""])].join(" ").trim();
    return { error: { code: CREDENTIAL_TTY_EXIT, lines: [
      `lares ${verb}: reads its credential from a terminal, and none stands on stdin and stdout; nothing ran`,
      `lares: run \`lares ${verb}\` in an interactive terminal (no flag, environment variable or pipe carries a credential)`,
    ] } };
  }
  return "forward";
}

// ── host paths in a forwarded argv ──────────────────────────────────────────────────────────────

/**
 * WHICH ARGUMENTS NAME PATHS, declared per command beside its scope. Only a declared argument translates: a bag
 * slug, a `lar:` address or a petname that happens to hold a slash never moves. Read off each verb's parser.
 */
const PATH_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  act:     ["out", "source"],                       // REPACK --source <bundle> [--out <file>]; --from names a bag
  ingest:  ["source"],
  meme:    ["file", "out", "root"],
  bag:     ["dir", "root"],                         // bag repo add --root <path>; --dir <bags dir>
  vault:   ["out"],
  library: ["out"],
  fleet:   ["out"],
  nexus:   ["out", "carry", "from", "source"],      // --from <partial|anchor file>; publish --source <dir>
  edge:    ["from"],                                // cosign --from <file>
  circle:  ["card"],
  handle:  ["card"],
  vessel:  ["genesis", "root", "restore", "storage"],
  sense:   ["sensorium-root", "trial-root", "model-home"],
  flow:    ["sensorium-root"],
};
/** Options that take a path OR inline text: a value translates only when a host file stands there. */
const PATH_OR_TEXT_OPTIONS: Readonly<Record<string, readonly string[]>> = { cabal: ["bundle"] };

/** The positional indexes (past the command) that name paths, and those that take an `@file` carriage. */
function pathPositions(args: ParsedArgs): { paths: number[]; atFiles: number[] } {
  const [p0, p1, p2] = args.positional;
  switch (args.command) {
    case "export": case "import": return { paths: [0], atFiles: [] };
    case "vault":     return { paths: p0 === "restore" ? [1] : [], atFiles: [] };
    case "library":   return { paths: p0 === "acquire" ? [1] : [], atFiles: [] };
    case "sensorium": return { paths: p0 === "run" || p0 === "open" ? [1] : [], atFiles: [] };
    case "fleet":     return { paths: p0 === "join" && (p1 === "request" || p1 === "answer" || p1 === "land") ? [2] : [], atFiles: [] };
    case "meme":      return { paths: p0 === "project" && !(p1 ?? "").startsWith("lar:") ? [1] : [], atFiles: [] };
    case "handle":    return { paths: [], atFiles: p0 === "verify-attestation" ? [1] : [] };
    case "circle":    return { paths: [], atFiles: p0 === "card" ? [1] : [] };
    case "nexus":
      if (p0 === "admit-take" || p0 === "carry-take") return { paths: [1], atFiles: [] };
      if (p0 === "seal" && p1 === "cofound" && (p2 === "join" || p2 === "seal")) return { paths: [3], atFiles: [] };
      if (p0 === "seal" && p1 === "roll" && (p2 === "join" || p2 === "sign" || p2 === "file")) return { paths: [3], atFiles: [] };
      return { paths: [], atFiles: [] };
    default: return { paths: [], atFiles: [] };
  }
}

/** One host directory the container house binds, and where the vessel reads it. */
export interface Mount { readonly host: string; readonly container: string }

const HOUSE_CLASSES = ["hearth", "sensoriums", "projections", "library", "config"] as const;
/**
 * Spellings already inside the vessel: they pass unchanged. Only the two roots the house binds (`/lar/**`, `/workspace/**`);
 * the image's own tree (`/app`) holds nothing an operator's argument should name, so a host path there reads as a host path.
 */
const CONTAINER_ROOTS = ["/lar", "/workspace"] as const;


/** The mounts the surface compose file binds: `$LARES_HOUSE/<class>` at `/lar/<class>`, `$LARES_WORKSPACE` at `/workspace`. */
export function mountsOf(env: Readonly<Record<string, string | undefined>>, envFileText: string | null, real: (p: string) => string): Mount[] {
  const mounts: Mount[] = [];
  const house = envValue("LARES_HOUSE", env, envFileText);
  if (house.startsWith("/")) for (const c of HOUSE_CLASSES) mounts.push({ host: real(join(house, c)), container: `/lar/${c}` });
  const workspace = envValue("LARES_WORKSPACE", env, envFileText);
  if (workspace.startsWith("/")) mounts.push({ host: real(workspace), container: "/workspace" });
  return mounts;
}

const under = (path: string, root: string): boolean => path === root || path.startsWith(root.endsWith("/") ? root : `${root}/`);

/** The realpath of the longest prefix that exists, with the rest appended (an output path need not exist yet). */
function realpathPrefix(abs: string, realpath: (p: string) => string): string {
  const rest: string[] = [];
  let at = abs;
  for (;;) {
    try { return join(realpath(at), ...rest.reverse()); }
    catch {
      const up = dirname(at);
      if (up === at) return abs;
      rest.push(basename(at));
      at = up;
    }
  }
}

export interface TranslateInput {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly home: string;
  readonly mounts: readonly Mount[];
  readonly fs: { exists(path: string): boolean; realpath(path: string): string };
}

/**
 * Rewrite each declared path argument from its host spelling to the vessel's, or refuse naming the one that rests
 * under no mount. A value already spelled inside the vessel (`/lar/…`, `/workspace/…`, `/app/…`), an empty value and
 * `-` (stdin) pass unchanged. `~` expands to HOME, a relative path reads from the cwd, and the longest existing prefix
 * resolves through its symlinks before the mount match.
 */
export function translatePaths(input: TranslateInput): { argv: string[] } | { error: RouteError } {
  const { argv, mounts, fs } = input;
  let args: ParsedArgs;
  try { args = parseArgs(argv); } catch { return { argv: [...argv] }; }
  const name = args.command ?? "";
  const pathOpts = new Set(PATH_OPTIONS[name] ?? []);
  const textOpts = new Set(PATH_OR_TEXT_OPTIONS[name] ?? []);
  const { paths, atFiles } = pathPositions(args);
  const byDepth = [...mounts].sort((a, b) => b.host.length - a.host.length);
  let refusal: RouteError | null = null;

  const toVessel = (value: string): string => {
    if (value === "" || value === "-" || refusal !== null) return value;
    if (CONTAINER_ROOTS.some((r) => under(value, r))) return value;
    const expanded = value === "~" ? input.home : value.startsWith("~/") ? join(input.home, value.slice(2)) : value;
    const real = realpathPrefix(resolve(input.cwd, expanded), fs.realpath);
    const mount = byDepth.find((m) => under(real, m.host));
    if (mount) return real === mount.host ? mount.container : `${mount.container}${real.slice(mount.host.length)}`;
    const config = mounts.find((m) => m.container === "/lar/config");
    const roots = mounts.length === 0
      ? "no mount stands named (LARES_HOUSE and LARES_WORKSPACE read unset)"
      : `${dirname(config?.host ?? mounts[0]!.host)}/{${HOUSE_CLASSES.join(",")}} -> /lar/<class>, ${mounts.find((m) => m.container === "/workspace")?.host ?? "(no workspace)"} -> /workspace`;
    refusal = { code: PATH_OUTSIDE_EXIT, lines: [
      `lares: ${value} rests outside every mount the container house binds, so the vessel cannot reach it; nothing ran`,
      `lares: mounts: ${roots}`,
      `lares: put it under ${config?.host ?? "$LARES_HOUSE/config"} (the vessel reads /lar/config/<name>), or pass a path spelled inside the vessel`,
    ] };
    return value;
  };
  const optionValue = (key: string, value: string): string => {
    if (pathOpts.has(key)) return toVessel(value);
    if (textOpts.has(key)) {
      const expanded = value.startsWith("~/") ? join(input.home, value.slice(2)) : value;
      return fs.exists(resolve(input.cwd, expanded)) ? toVessel(value) : value;
    }
    return value;
  };

  // Walk the raw tokens the way parseArgs reads them, so each value keeps its own spelling and place.
  const out: string[] = [argv[0]!];
  let positional = 0;
  let endOfOptions = false;
  for (let i = 1; i < argv.length; i++) {
    const tok = argv[i]!;
    if (!endOfOptions && tok === "--") { endOfOptions = true; out.push(tok); continue; }
    if (!endOfOptions && tok.startsWith("--")) {
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      if (body.startsWith("no-")) { out.push(tok); continue; }
      if (eq !== -1) { const key = body.slice(0, eq); out.push(`--${key}=${optionValue(key, body.slice(eq + 1))}`); continue; }
      if (BOOLEAN_FLAGS.has(body)) { out.push(tok); continue; }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) { out.push(tok, optionValue(body, next)); i++; continue; }
      out.push(tok);
      continue;
    }
    if (paths.includes(positional)) out.push(toVessel(tok));
    else if (atFiles.includes(positional) && tok.startsWith("@") && tok !== "@-") out.push(`@${toVessel(tok.slice(1))}`);
    else out.push(tok);
    positional++;
  }
  return refusal !== null ? { error: refusal } : { argv: out };
}


/**
 * Run the shim with the same argv, stdio inherited, and answer its exit code.
 *
 * No shell parses the argv: `/bin/sh` reads the shim's path and each argument rides as its own element, so
 * quoting, spaces, empty strings and `--` arrive as typed. A terminal's Ctrl+C reaches the whole foreground group
 * (this process, the shim, docker), so this process holds SIGINT and SIGQUIT until the child ends and then ends the
 * same way; a SIGTERM or SIGHUP sent to this process alone passes to the child. A child that ended by a signal ends
 * this process by the same signal.
 */
export function forwardToShim(shim: string, argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("/bin/sh", [shim, ...argv], { stdio: "inherit", env });
    const hold = (): void => { /* the child got it from the terminal; wait for its end */ };
    const pass = (sig: NodeJS.Signals) => (): void => { child.kill(sig); };
    const handlers: [NodeJS.Signals, () => void][] = [
      ["SIGINT", hold], ["SIGQUIT", hold], ["SIGTERM", pass("SIGTERM")], ["SIGHUP", pass("SIGHUP")],
    ];
    for (const [sig, fn] of handlers) process.on(sig, fn);
    const release = (): void => { for (const [sig, fn] of handlers) process.off(sig, fn); };
    child.on("error", (err) => {
      release();
      console.error(`lares: the shim did not start (${err.message}); run ${shim} directly to read why`);
      resolve(SHIM_ABSENT_EXIT);
    });
    child.on("exit", (code, signal) => {
      release();
      if (signal !== null) { process.kill(process.pid, signal); return; }
      resolve(code ?? 1);
    });
  });
}

/**
 * The bridge as the entry point runs it: null when the verb runs in this process, else the exit code the forward
 * (or its refusal) answers.
 */
export async function bridge(argv: readonly string[], commands: readonly string[]): Promise<number | null> {
  const shim = locateShim();
  const route = decideRoute({
    argv, env: process.env, commands, shim,
    fsProbe: { exists: existsSync },
    tty: process.stdin.isTTY === true && process.stdout.isTTY === true,
  });
  if (route === "local") return null;
  if (route !== "forward") {
    for (const line of route.error.lines) console.error(line);
    return route.error.code;
  }
  const envFile = surfaceEnvPath(process.env);
  let envFileText: string | null = null;
  try { envFileText = envFile === null ? null : readFileSync(envFile, "utf8"); } catch { envFileText = null; }
  const real = (p: string): string => { try { return realpathSync(p); } catch { return p; } };
  const translated = translatePaths({
    argv, cwd: process.cwd(), home: process.env["HOME"] ?? "",
    mounts: mountsOf(process.env, envFileText, real),
    fs: { exists: existsSync, realpath: realpathSync },
  });
  if ("error" in translated) {
    for (const line of translated.error.lines) console.error(line);
    return translated.error.code;
  }
  return await forwardToShim(shim as string, translated.argv, forwardEnvFor(process.env, ownPeerKind(process.env)));
}

/**
 * THE HOST CHAIN CROSSES THE WALL AS THE SEAT MARK (hitl-reads-a-hand). Inside the vessel an exec'd process has no parent to
 * walk (its parent pid reads 0), so neither the vessel's own CLI (`readOwnHand`) nor its socket (`peerKindOf`) can see a harness
 * that launched the host `lares`. The forwarder reads its own host chain BEFORE it forwards any command, and anything but a
 * person's hand (`ai`, or `unknown`: an unread chain never reads as a person) sends the forwarded child the seat mark
 * (`CLAUDECODE=1`), which the shim hands into the vessel by name. Every hand verb inside then refuses as it refuses a seat.
 */
export function forwardEnvFor(env: NodeJS.ProcessEnv, kind: PeerKind): NodeJS.ProcessEnv {
  return kind === "hand" ? env : { ...env, CLAUDECODE: "1" };
}
