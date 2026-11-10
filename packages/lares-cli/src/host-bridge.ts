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
 * from the table; `wing-of` reads a transcript on this disk; `mempalace` tends the guest comparator in this home;
 * `meme normalize|check` and `meme project <file> --to md` run over a file with no daemon. They never forward.
 *
 * NEVER INSIDE THE VESSEL. The image sets `LAR_ROOT=/lar` and `LARES_IN_CONTAINER=1`, and docker plants `/.dockerenv`;
 * any of them keeps the route local, so a vessel whose environment lost its root refuses by name instead of looping.
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

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, ArgsError, type ParsedArgs } from "./parse-args.js";

/** No house root here, and no container house stands to answer (sysexits EX_CONFIG). */
export const HOUSE_ABSENT_EXIT = 78;
/** The container house stands and the checkout's shim does not (sysexits EX_UNAVAILABLE). */
export const SHIM_ABSENT_EXIT = 69;
/** A credential verb with no terminal on both ends: the usage code the CLI's CredentialTtyRefusal reads. */
export const CREDENTIAL_TTY_EXIT = 2;

/** The names the shim hands into the vessel by `-e NAME`: display and debug alone, never a credential. */
export const FORWARDED_ENV: readonly string[] = ["NO_COLOR", "TERM", "COLORTERM", "LARES_DEBUG"];

/** The image's own marker: set in the Dockerfile, so a vessel never forwards to itself. */
export const IN_CONTAINER_ENV = "LARES_IN_CONTAINER";

/** The shim's own verbs: no CLI command answers them, and the shim does. */
const SHIM_VERBS: ReadonlySet<string> = new Set(["up", "down", "reset", "found", "logs", "build"]);

/** Commands that run on this machine whole. */
const HOST_COMMANDS: ReadonlySet<string> = new Set(["home", "repo", "help", "wing-of", "mempalace"]);

/** Commands with some sub-verbs local and the rest in the vessel. */
const MIXED_COMMANDS: ReadonlySet<string> = new Set(["meme"]);

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

/** The operator's container env file, or null while HOME names no home. */
export function surfaceEnvPath(env: Readonly<Record<string, string | undefined>>): string | null {
  const home = env["HOME"]?.trim();
  return home ? join(home, ".lares", "lares-surface.env") : null;
}

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
  if (args.command === "vault") return sub === "unlock" || sub === "bind" || sub === "unbind" || sub === "rewrap";
  if (args.command === "vessel") return sub === "found" || sub === "rotate";
  return false;
}

/**
 * Local, forward, or a named refusal — from argv, env and a file probe alone.
 */
export function decideRoute(input: RouteInput): Route {
  const { argv, env, fsProbe } = input;
  if ((env["LAR_ROOT"] ?? "").trim() !== "") return "local";
  if ((env[IN_CONTAINER_ENV] ?? "").trim() !== "" || fsProbe.exists("/.dockerenv")) return "local";
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

/** The checkout's shim, found by walking up from this module (a symlinked bin resolves to its real path). */
export function locateShim(from: string = fileURLToPath(import.meta.url)): string | null {
  let dir = dirname(from);
  for (;;) {
    const candidate = join(dir, "tools", "lares-container.sh");
    if (existsSync(candidate)) return candidate;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
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
  return await forwardToShim(shim as string, argv);
}
