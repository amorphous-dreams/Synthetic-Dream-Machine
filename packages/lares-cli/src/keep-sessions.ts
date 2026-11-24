/**
 * keep-sessions — the device's Claude Code sessions as the keep carries them: the device id, the mirror into
 * `<workspace>/devices/<name>-<id8>/`, and the sanitize of `~/.claude.json`.
 *
 * THE PORT OF THE OPERATOR'S `claude-backup/bin/sync`, path for path, exclude for exclude, byte for byte
 * (`tests/keep-sessions.test.ts` reads this mirror against that script's own mirror half). What it writes:
 *
 *   DEVICE.json              the device identity, the very bytes of `<config>/claude-backup/device.json`
 *   config/                  CLAUDE.md, settings.json, settings.local.json, settings.json.bak* (copied, never cleared);
 *                            rules/ skills/ plans/ agents/ (mirrored, deletions too); plugins/installed_plugins.json,
 *                            plugins/known_marketplaces.json, plugins/data/; claude.json (`~/.claude.json`, SANITIZED)
 *   state/                   history.jsonl, stats-cache.json; tasks/ feedback/ state/ (mirrored); each job's state.json alone, at any depth
 *   projects/<project>/      memory/ (mirrored, plain files); sessions/<rel>.jsonl.zst, each transcript zstd-compressed once it
 *                            has rested idle, and again whenever its source reads newer than the copy
 *
 * Nothing else of the home leaves it: no credentials, no caches, no shell snapshots, no raw `~/.claude.json`.
 *
 * THE DEVICE ID: a UUIDv5 (URL namespace) over `claude-backup:<machine-id>`, minted once and kept under the config home, so a
 * renamed host or a second machine of the same name never lands in another device's directory. A device dir whose DEVICE.json
 * names another uuid refuses.
 *
 * EVERY SOURCE RIDES A PORT (`SessionSources`): `sessionSources(env)` reads CLAUDE_HOME, CLAUDE_JSON, XDG_CONFIG_HOME, IDLE_MIN
 * and LARES_MACHINE_ID_FILE over HOME, so a test stands the whole home on scratch.
 *
 * The bytes follow python's, since the script wrote its JSON through `json.dump`: `device.json` in mint order, `claude.json`
 * with sorted keys, both ASCII-escaped at two spaces, numbers in python's own spelling (`pyJson*` below).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, statSync,
  symlinkSync, utimesSync, writeFileSync, type Stats,
} from "node:fs";
import { hostname, release, type as osType } from "node:os";
import { dirname, join } from "node:path";
import * as zlib from "node:zlib";

/** A refusal the session mirror raises by name; the message carries the cure. */
export class SessionsRefused extends Error {
  override readonly name = "SessionsRefused";
  constructor(readonly code: string, message: string) { super(`${code}: ${message}`); }
}

/** Where the mirror rests inside a keep workspace. */
export const DEVICES_DIR = "devices";

export interface SessionSources {
  /** The Claude Code home (`~/.claude`). */
  readonly claudeHome: string;
  /** The Claude Code store (`~/.claude.json`). */
  readonly claudeJson: string;
  /** The kept device identity (`<config>/claude-backup/device.json`). */
  readonly deviceFile: string;
  /** Where a machine-id may stand, in order; the first path that exists seeds the mint. */
  readonly machineIdPaths: readonly string[];
  /** A transcript mirrors once it has rested this many minutes. */
  readonly idleMinutes: number;
  hostname(): string;
  /** The OS line a minted identity carries (`<system> <release>`). */
  osName(): string;
  randomUuid(): string;
  /** Milliseconds now. */
  now(): number;
  /** Compress `src` into `dest` as `zstd -q -9 -T0 -f` does; false where the compressor answered a failure. */
  zstd(src: string, dest: string): boolean;
  /** The bytes a `.zst` file holds. */
  unzstd(path: string): Buffer;
}

export interface KeepDevice { readonly uuid: string; readonly name: string; /** `<name>-<id8>`. */ readonly dir: string }

/** The live sources one environment names. */
export function sessionSources(env: Readonly<Record<string, string | undefined>> = process.env): SessionSources {
  const set = (k: string): string | undefined => { const v = env[k]; return v !== undefined && v !== "" ? v : undefined; };
  const home = set("HOME");
  const under = (rel: string): string => {
    if (home === undefined) throw new SessionsRefused("keep-sessions-home-unnamed", "HOME names no home, so the keep finds no Claude Code state to mirror; name CLAUDE_HOME, CLAUDE_JSON and XDG_CONFIG_HOME, or keep with --no-sessions");
    return join(home, rel);
  };
  const machineId = set("LARES_MACHINE_ID_FILE");
  const idle = Number(set("IDLE_MIN") ?? "10");
  return {
    claudeHome: set("CLAUDE_HOME") ?? under(".claude"),
    claudeJson: set("CLAUDE_JSON") ?? under(".claude.json"),
    deviceFile: join(set("XDG_CONFIG_HOME") ?? under(".config"), "claude-backup", "device.json"),
    machineIdPaths: machineId !== undefined ? [machineId] : ["/etc/machine-id", "/var/lib/dbus/machine-id"],
    idleMinutes: Number.isFinite(idle) && idle >= 0 ? idle : 10,
    hostname: () => hostname(),
    osName: () => `${osType()} ${release()}`,
    randomUuid: () => randomUUID(),
    now: () => Date.now(),
    zstd: (src, dest) => {
      const r = spawnSync("zstd", ["-q", "-9", "-T0", "-f", src, "-o", dest], { stdio: "ignore" });
      if (r.error !== undefined) throw new SessionsRefused("keep-sessions-zstd-absent", `the \`zstd\` binary did not run (${r.error.message}); the mirror compresses each transcript through it, so install zstd or keep with --no-sessions`);
      return r.status === 0;
    },
    unzstd: (path) => {
      if (typeof zlib.zstdDecompressSync === "function") return zlib.zstdDecompressSync(readFileSync(path));
      const r = spawnSync("zstd", ["-dc", path], { maxBuffer: 2 ** 31 - 1 });
      if (r.error !== undefined || r.status !== 0) throw new Error(`zstd -dc ${path}: ${r.error?.message ?? `exit ${String(r.status)}`}`);
      return r.stdout;
    },
  };
}

// ── python's JSON bytes ─────────────────────────────────────────────────────────────────────────────────────────────

/** A number as its source spelled it: python keeps every digit of a whole number, and a float takes python's `repr`. */
class PyNumber { constructor(readonly lexeme: string) {} }
type PyJson = null | boolean | string | PyNumber | PyJson[] | Map<string, PyJson>;

/** python's `repr` of a float: the shortest digits that read back, an exponent outside 1e-4..1e16, a point always. */
function pyFloat(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expText] = Math.abs(x).toExponential().split("e") as [string, string];
  const digits = mant.replace(".", ""), exp = Number(expText), sign = x < 0 ? "-" : "";
  if (exp < -4 || exp >= 16) {
    const e = Math.abs(exp);
    return `${sign}${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ""}e${exp < 0 ? "-" : "+"}${e < 10 ? "0" : ""}${e}`;
  }
  if (exp < 0) return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
  const whole = digits.length > exp + 1 ? digits.slice(0, exp + 1) : digits.padEnd(exp + 1, "0");
  return `${sign}${whole}.${digits.length > exp + 1 ? digits.slice(exp + 1) : "0"}`;
}

const pyNumber = (lexeme: string): string => {
  if (lexeme === "NaN" || lexeme === "Infinity" || lexeme === "-Infinity") return lexeme;
  if (/^-?\d+$/.test(lexeme)) return /^-?0+$/.test(lexeme) ? "0" : lexeme;
  return pyFloat(Number(lexeme));
};

/** JSON read as python's `json.load` reads it: an object keeps its keys in order (a repeated key takes its last value). */
function pyJsonParse(text: string): PyJson {
  let i = 0;
  const fail = (what: string): never => { throw new SyntaxError(`${what} at offset ${i}`); };
  const space = (): void => { while (i < text.length && " \t\n\r".includes(text[i]!)) i++; };
  const value = (): PyJson => {
    space();
    const c = text[i];
    if (c === "{") {
      i++;
      const out = new Map<string, PyJson>();
      space();
      if (text[i] === "}") { i++; return out; }
      for (;;) {
        space();
        if (text[i] !== '"') fail("an object key reads as no string");
        const key = string();
        space();
        if (text[i++] !== ":") fail("an object key takes no colon");
        const v = value();
        out.set(key, v);
        space();
        const next = text[i++];
        if (next === "}") return out;
        if (next !== ",") fail("an object closes on no brace");
      }
    }
    if (c === "[") {
      i++;
      const out: PyJson[] = [];
      space();
      if (text[i] === "]") { i++; return out; }
      for (;;) {
        out.push(value());
        space();
        const next = text[i++];
        if (next === "]") return out;
        if (next !== ",") fail("a list closes on no bracket");
      }
    }
    if (c === '"') return string();
    for (const [word, v] of [["true", true], ["false", false], ["null", null]] as const) if (text.startsWith(word, i)) { i += word.length; return v; }
    for (const word of ["NaN", "Infinity", "-Infinity"]) if (text.startsWith(word, i)) { i += word.length; return new PyNumber(word); }
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
    if (m === null) return fail("no value reads");
    i += m[0].length;
    return new PyNumber(m[0]);
  };
  const string = (): string => {
    const start = i++;
    for (; i < text.length; i++) {
      if (text[i] === "\\") i++;
      else if (text[i] === '"') { i++; return JSON.parse(text.slice(start, i)) as string; }
    }
    return fail("a string never closes");
  };
  const out = value();
  space();
  if (i !== text.length) fail("text stands after the value");
  return out;
}

/** python's `ensure_ascii` string: everything outside space..tilde escapes, a pair as its two halves, hex in lower case. */
const pyString = (s: string): string => JSON.stringify(s).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

/** Keys in python's order: by code point, where UTF-16 units would seat a pair before U+E000. */
const byCodePoint = (a: string, b: string): number => {
  const x = Array.from(a), y = Array.from(b);
  for (let k = 0; k < x.length && k < y.length; k++) { const d = x[k]!.codePointAt(0)! - y[k]!.codePointAt(0)!; if (d !== 0) return d; }
  return x.length - y.length;
};

/** python's `json.dump(value, indent=2[, sort_keys=True])`, with no trailing newline. */
function pyJsonDump(value: PyJson, sortKeys: boolean, depth = 0): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return pyString(value);
  if (value instanceof PyNumber) return pyNumber(value.lexeme);
  const pad = "  ".repeat(depth + 1), close = "  ".repeat(depth);
  if (Array.isArray(value)) return value.length === 0 ? "[]" : `[\n${value.map((v) => `${pad}${pyJsonDump(v, sortKeys, depth + 1)}`).join(",\n")}\n${close}]`;
  const keys = sortKeys ? [...value.keys()].sort(byCodePoint) : [...value.keys()];
  return keys.length === 0 ? "{}" : `{\n${keys.map((k) => `${pad}${pyString(k)}: ${pyJsonDump(value.get(k)!, sortKeys, depth + 1)}`).join(",\n")}\n${close}}`;
}

// ── the device id ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A UUIDv5 in the URL namespace (RFC 4122): python's `uuid.uuid5(uuid.NAMESPACE_URL, name)`. */
export function uuid5Url(name: string): string {
  const h = createHash("sha1").update(Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex")).update(name, "utf8").digest().subarray(0, 16);
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/** One field of a JSON file, as the script's `field` reads it (python prints a string bare). */
function fieldOf(path: string, key: string): string {
  let read: unknown;
  try { read = JSON.parse(readFileSync(path, "utf8")); } catch (e) { throw new SessionsRefused("keep-device-unread", `${path} reads as no JSON (${(e as Error).message}); mend it or remove it, and the keep mints or reads the identity again`); }
  const v = (read as Record<string, unknown> | null)?.[key];
  if (typeof v !== "string" || v === "") throw new SessionsRefused("keep-device-unread", `${path} names no \`${key}\`; mend it or remove it, and the keep mints or reads the identity again`);
  return v;
}

/** This device's identity: read where it stands kept, minted once where it stands absent. */
export function readOrMintDevice(src: SessionSources): KeepDevice {
  if (!isFile(src.deviceFile)) {
    let seed = "";
    for (const p of src.machineIdPaths) if (existsSync(p)) { seed = readFileSync(p, "utf8").trim(); break; }
    if (seed === "") seed = src.randomUuid();   // no machine-id: a random, still-unique identity
    const host = src.hostname();
    const dev = new Map<string, PyJson>([["uuid", uuid5Url(`claude-backup:${seed}`)], ["name", host.toLowerCase()], ["hostname", host], ["os", src.osName()]]);
    mkdirSync(dirname(src.deviceFile), { recursive: true });
    writeFileSync(src.deviceFile, pyJsonDump(dev, false));
  }
  const uuid = fieldOf(src.deviceFile, "uuid"), name = fieldOf(src.deviceFile, "name");
  // The name seats one path segment under `devices/`: a kept identity that names a way out of it refuses.
  if (/[/\\\0]/.test(name) || name.startsWith(".") || !/^[0-9a-f]{8}/i.test(uuid)) throw new SessionsRefused("keep-device-malformed", `${src.deviceFile} names the device ${JSON.stringify(name.slice(0, 80))} (${uuid.slice(0, 40)}), which seats no plain directory under ${DEVICES_DIR}/; mend the file`);
  return { uuid, name, dir: `${name}-${uuid.slice(0, 8)}` };
}

/** The device this machine already names, read and never minted: null where no identity file stands (a keep that mirrors nothing names no device). */
export function readDevice(src: SessionSources): KeepDevice | null {
  return isFile(src.deviceFile) ? readOrMintDevice(src) : null;
}

// ── the sanitize ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The top-level keys that name the account or carry a push key: they never leave the device. */
const DROP: ReadonlySet<string> = new Set(["oauthAccount", "userID", "rcLongTurnNudgeSeenKey", "remoteControlReadyPushKey"]);
const REDACTED = "<redacted>";

/** `~/.claude.json` with account identity and every `cached*` key dropped, and each MCP server's env and headers redacted. */
export function sanitizeClaudeJson(text: string): string {
  let d: PyJson;
  try { d = pyJsonParse(text); } catch (e) { throw new SessionsRefused("keep-sessions-claude-json-unread", `the Claude Code store reads as no JSON (${(e as Error).message}); nothing of it mirrors, so the keep stops rather than carry an unsanitized copy`); }
  if (!(d instanceof Map)) throw new SessionsRefused("keep-sessions-claude-json-unread", "the Claude Code store holds no JSON object; nothing of it mirrors");
  const kept = new Map([...d].filter(([k]) => !DROP.has(k) && !k.startsWith("cached")));
  const redact = (servers: PyJson | undefined): void => {
    if (!(servers instanceof Map)) return;
    for (const s of servers.values()) {
      if (!(s instanceof Map)) continue;
      for (const field of ["env", "headers"]) {
        const held = s.get(field);
        if (held instanceof Map) s.set(field, new Map([...held.keys()].map((k) => [k, REDACTED] as [string, PyJson])));
      }
    }
  };
  redact(kept.get("mcpServers"));
  const projects = kept.get("projects");
  if (projects instanceof Map) for (const p of projects.values()) if (p instanceof Map) redact(p.get("mcpServers"));
  return pyJsonDump(kept, true);
}

// ── the mirror ──────────────────────────────────────────────────────────────────────────────────────────────────────

const stat = (p: string): Stats | null => { try { return statSync(p); } catch { return null; } };
const lstat = (p: string): Stats | null => { try { return lstatSync(p); } catch { return null; } };
/** `[ -f p ]` and `[ -d p ]`: each follows a link. */
const isFile = (p: string): boolean => stat(p)?.isFile() === true;
const isDir = (p: string): boolean => stat(p)?.isDirectory() === true;

const sameInstant = (a: Stats, b: Stats): boolean => Math.floor(a.mtimeMs) === Math.floor(b.mtimeMs);
const stamp = (dest: string, from: Stats): void => { chmodSync(dest, from.mode & 0o7777); utimesSync(dest, from.atime, from.mtime); };

/** `cp -p src dest`: the bytes a link resolves to, the mode and the modification time. */
function copyKeeping(src: string, dest: string): void {
  const held = lstat(dest);
  if (held !== null && !held.isFile()) rmSync(dest, { recursive: true, force: true });
  copyFileSync(src, dest);
  stamp(dest, statSync(src));
}

/**
 * `rsync -a --delete src/ dest/`: the tree under `src` as it stands, a link as a link, each file's mode and modification time,
 * and every entry of `dest` that `src` lacks cleared. A file whose size and modification time already match stays untouched
 * (rsync's own quick check). A fifo, a socket or a device mirrors nowhere.
 */
function mirrorTree(src: string, dest: string): void {
  const held = lstat(dest);
  if (held !== null && !held.isDirectory()) rmSync(dest, { force: true });
  mkdirSync(dest, { recursive: true });
  const names = new Set<string>();
  for (const name of readdirSync(src)) {
    const from = join(src, name), to = join(dest, name), st = lstatSync(from), at = lstat(to);
    if (st.isSymbolicLink()) {
      const target = readlinkSync(from);
      if (!(at?.isSymbolicLink() === true && readlinkSync(to) === target)) { if (at !== null) rmSync(to, { recursive: true, force: true }); symlinkSync(target, to); }
    } else if (st.isDirectory()) {
      mirrorTree(from, to);
    } else if (st.isFile()) {
      if (at !== null && !at.isFile()) rmSync(to, { recursive: true, force: true });
      if (!(at?.isFile() === true && at.size === st.size && sameInstant(at, st))) copyFileSync(from, to);
      stamp(to, st);
    } else continue;
    names.add(name);
  }
  for (const name of readdirSync(dest)) if (!names.has(name)) rmSync(join(dest, name), { recursive: true, force: true });
  stamp(dest, statSync(src));
}

/**
 * rsync's filtered mirror (`-a --delete --prune-empty-dirs`, including every directory and `state.json`, excluding the rest): every entry named
 * `state.json` under a real directory of `src`, each directory that leads to one, and nothing else. A `state.json` the source
 * lost leaves `dest`, and so does a directory left holding none; a file of another name in `dest` stands as the filter left it.
 */
function mirrorJobStates(src: string, dest: string): void {
  const walk = (from: string, to: string, top: boolean): boolean => {
    let any = false;
    const names = new Set<string>();
    for (const name of readdirSync(from)) {
      const a = join(from, name), b = join(to, name), st = lstatSync(a);
      if (st.isDirectory()) {
        if (walk(a, b, false)) { any = true; names.add(name); }
      } else if (name === "state.json" && (st.isFile() || st.isSymbolicLink())) {
        mkdirSync(to, { recursive: true });
        const at = lstat(b);
        if (st.isSymbolicLink()) {
          const target = readlinkSync(a);
          if (!(at?.isSymbolicLink() === true && readlinkSync(b) === target)) { if (at !== null) rmSync(b, { recursive: true, force: true }); symlinkSync(target, b); }
        } else {
          if (at !== null && !at.isFile()) rmSync(b, { recursive: true, force: true });
          if (!(at?.isFile() === true && at.size === st.size && sameInstant(at, st))) copyFileSync(a, b);
          stamp(b, st);
        }
        any = true;
        names.add(name);
      }
    }
    const held = lstat(to);
    if (held?.isDirectory() === true) {
      for (const name of readdirSync(to)) {
        if (names.has(name)) continue;
        const b = join(to, name), st = lstatSync(b);
        // The filter shields a file of any other name from the delete; a directory and a `state.json` fall under it.
        if (st.isDirectory() || name === "state.json") rmSync(b, { recursive: true, force: true });
        else any = true;
      }
      if (any || top) stamp(to, statSync(from));
    }
    return any;
  };
  mkdirSync(dest, { recursive: true });
  walk(src, dest, true);
}

/** Every regular file named `*.jsonl` under `dir` (a link below it never followed), by its path relative to `dir`. */
function transcriptsUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (at: string, rel: string): void => {
    let names: string[];
    try { names = readdirSync(at); } catch { return; }
    for (const name of names) {
      const abs = join(at, name), r = rel === "" ? name : `${rel}/${name}`, st = lstat(abs);
      if (st === null) continue;
      if (st.isDirectory()) walk(abs, r);
      else if (st.isFile() && name.endsWith(".jsonl")) out.push(r);
    }
  };
  walk(dir, "");
  return out;
}

export interface SessionsMirrored {
  /** The device dir's name, `<name>-<id8>`. */
  readonly device: string;
  /** Its place inside the workspace: `devices/<name>-<id8>`. */
  readonly rel: string;
  /** Transcripts the compressor answered a failure for, by source path; each waits for the next keep. */
  readonly unpacked: readonly string[];
}

/** Mirror this device's sessions into `<workspace>/devices/<name>-<id8>/`, or refuse a dir another device owns. */
export function mirrorSessions(src: SessionSources, workspace: string, device: KeepDevice): SessionsMirrored {
  const rel = `${DEVICES_DIR}/${device.dir}`, dest = join(workspace, DEVICES_DIR, device.dir);
  // Refuse to write into a directory another device owns.
  const owner = join(dest, "DEVICE.json");
  if (isFile(owner) && fieldOf(owner, "uuid") !== device.uuid) throw new SessionsRefused("keep-device-foreign", `${rel} belongs to another device (its DEVICE.json names ${fieldOf(owner, "uuid")}, and this device reads ${device.uuid}); nothing writes there. Two devices of one name and id prefix share no directory: rename this one in ${src.deviceFile}`);
  for (const d of ["config", "projects", "state"]) mkdirSync(join(dest, d), { recursive: true });
  writeFileSync(owner, readFileSync(src.deviceFile));
  const home = src.claudeHome;

  // ── Config: an explicit allow-list, never the whole home ──────────────────────────────────────────────────────
  const tops = new Set(["CLAUDE.md", "settings.json", "settings.local.json"]);
  let entries: string[] = [];
  try { entries = readdirSync(home); } catch { entries = []; }
  for (const name of entries) if (name.startsWith("settings.json.bak")) tops.add(name);
  for (const name of tops) if (isFile(join(home, name))) copyKeeping(join(home, name), join(dest, "config", name));
  for (const d of ["rules", "skills", "plans", "agents"]) if (isDir(join(home, d))) mirrorTree(join(home, d), join(dest, "config", d));
  mkdirSync(join(dest, "config", "plugins"), { recursive: true });
  for (const f of ["installed_plugins.json", "known_marketplaces.json"]) if (isFile(join(home, "plugins", f))) copyKeeping(join(home, "plugins", f), join(dest, "config", "plugins", f));
  if (isDir(join(home, "plugins", "data"))) mirrorTree(join(home, "plugins", "data"), join(dest, "config", "plugins", "data"));

  // ~/.claude.json, sanitized: account identity and secret-bearing values never leave the device.
  if (isFile(src.claudeJson)) writeFileSync(join(dest, "config", "claude.json"), sanitizeClaudeJson(readFileSync(src.claudeJson, "utf8")));

  // ── State: prompt history, task lists, stats, feedback drafts, background-job state ───────────────────────────
  for (const f of ["history.jsonl", "stats-cache.json"]) if (isFile(join(home, f))) copyKeeping(join(home, f), join(dest, "state", f));
  for (const d of ["tasks", "feedback", "state"]) if (isDir(join(home, d))) mirrorTree(join(home, d), join(dest, "state", d));
  if (isDir(join(home, "jobs"))) mirrorJobStates(join(home, "jobs"), join(dest, "state", "jobs"));

  // ── Per project: memory as plain text; transcripts compressed once idle ────────────────────────────────────────
  const unpacked: string[] = [];
  let projects: string[] = [];
  try { projects = readdirSync(join(home, "projects")); } catch { projects = []; }
  const idleBefore = src.now() - src.idleMinutes * 60_000;
  for (const name of projects.sort()) {
    const p = join(home, "projects", name);
    if (name.startsWith(".") || !isDir(p)) continue;
    const out = join(dest, "projects", name);
    if (isDir(join(p, "memory"))) { mkdirSync(join(out, "memory"), { recursive: true }); mirrorTree(join(p, "memory"), join(out, "memory")); }
    for (const r of transcriptsUnder(p)) {
      const f = join(p, ...r.split("/")), st = lstat(f);
      if (st === null || !(st.mtimeMs < idleBefore)) continue;
      const target = join(out, "sessions", ...`${r}.zst`.split("/")), kept = stat(target);
      if (kept?.isFile() === true && !(st.mtimeMs > kept.mtimeMs)) continue;
      mkdirSync(dirname(target), { recursive: true });
      if (src.zstd(f, `${target}.tmp`)) renameSync(`${target}.tmp`, target);
      else { rmSync(`${target}.tmp`, { force: true }); unpacked.push(f); }
    }
  }
  return { device: device.dir, rel, unpacked };
}
