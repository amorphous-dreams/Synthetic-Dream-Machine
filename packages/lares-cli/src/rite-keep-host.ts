/**
 * rite-keep-host — the keep rite's host half: the bundle the vessel laid into a bound workspace goes into the operator's repo,
 * and the tessera lands at the bundle id the pushed tree holds.
 *
 * git runs on the host (the workspace is a clone of the operator's own private repo), so the commit, the rebase and the push
 * belong here, as kūkulu's shim verbs do. The rite runs behind three ports, in one order:
 *
 *   1. the guard     the workspace stands as a repo at its top, on a branch with a remote; `<into>` reads `-text` (a
 *                    `.gitattributes` with `* -text` stands), so no line-ending rewrite moves a byte the manifest hashes;
 *                    and nothing outside `<into>` and this device's `devices/<name>-<id8>/` stands changed. A guard that
 *                    refuses spends nothing.
 *   2. the sessions  ON THE HOST: this device's Claude Code sessions mirror into `devices/<name>-<id8>/`
 *                    (`./keep-sessions.ts`), and the secret scan reads the mirror, a compressed transcript by its own bytes.
 *                    A dir another device owns, or a secret-shaped string, refuses here, before any return spends
 *   3. keep-cut      first the shore's flush (`lares shore flush`, through the bridge): the vessel flushes every island that
 *                    mounts a disk shore (the daemon's with each lit face's, and every resident wiki's: the teardown's own
 *                    flush), and the rite says what each wrote or left. A flush that leaves a carrier unwritten never stops
 *                    the keep: the bundle cuts from the records. Then IN THE VESSEL: the vessel half (`rite-keep.ts`): the lei's return, the
 *                    cut, the guest half
 *   4. the guard     again over what the cut left: only `<into>` and the device's dir changed, the manifest the host reads
 *                    names the vessel's bundle id (the host's directory and the vessel's stand as one), and the secret scan
 *                    finds nothing in the bundle
 *   5. the return    sessions that moved over a house that did not spend a return of their own: `rite begin` over the
 *                    standing bundle, IN THE VESSEL. A cut that kept already spent the one return this push rides, and so did
 *                    a keep whose tessera conferre still reads `landed-absent` at this bundle
 *   6. git           `git add <into> devices/<name>-<id8>`, ONE commit `keep <bundleId>` under the keep's own neutral name
 *                    ({@link KEEP_AUTHOR}, never the host's identity), fetch, rebase onto the upstream, ONE push
 *   7. rite-land     IN THE VESSEL: land each keep tessera owed at the bundle id read from the PUSHED manifest; conferre
 *                    reads it par
 *
 * NO PUSH WITHOUT A SPENT RETURN. The keep lei lives in the vessel's store, so with the vessel down the vessel half answers
 * nothing: the rite names that (`the keep lei lives in the vessel; up, then keep`), exits non-zero, and commits and pushes
 * nothing; the mirror rests in the workspace for the keep that follows the `up`. `sessions: false` (`--no-sessions`, or
 * LARES_KEEP_SESSIONS=0 in the house config, `./keep-config.ts`) keeps the house alone.
 *
 * A PUSH THAT FAILS leaves the tessera red (`landed-absent`) and names the cure: mend the remote and run the rite again. A
 * second run finds the bundle standing, pushes the commit that waits, and lands every keep tessera conferre reads open at
 * that bundle id. An unchanged keep commits nothing, pushes nothing and lands nothing.
 *
 * `--if-due` (the call `down` makes, and the session-end hook's): a house that has not moved since the bundle its
 * remote-tracking branch already holds, with no keep tessera owed at that bundle and no session file moved, stops after the
 * cut: no fetch, no push, no landing, nothing spent (`due: false`). A moved house, moved sessions, or a bundle that still waits
 * for its push or its landing, keeps as a plain keep does (`due: true`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { secretShapes } from "@lararium/mesh/secret-shapes";
import { join } from "node:path";
import { MANIFEST_FILE, unsafeRelPath } from "./bundle-manifest.js";
import { configuredKeepSessions } from "./keep-config.js";
import { DEVICES_DIR, SessionsRefused, mirrorSessions, readDevice, readOrMintDevice, sessionSources, type KeepDevice, type SessionSources } from "./keep-sessions.js";
import { KEEP_INTO, KeepRefused, RITE_KEEP, codedMessage, keepFaceLine, keepLeiGate } from "./rite-keep.js";
import { RETURNS_SPENT, type RefillPort, type RiteVerbAnswer } from "./rite-kukulu.js";
import type { ShoreFlushReading } from "./shore-core.js";

// THE SECRET-SHAPE SCAN has one owner, `@lararium/mesh` (`secret-shapes.ts`): the keep's guard and the house alert's read
// redaction read the same list, so a shape added once guards both.
export {
  KEEP_SECRET_PATTERN,
  KEEP_KEY_HEADER,
  KEEP_KEY_BODY_MIN,
  KEEP_KEY_BODY_LINES,
  KEEP_KEY_LINE_MIN,
  KEEP_SECRET_ALLOW,
  secretShapes,
} from "@lararium/mesh/secret-shapes";

/**
 * THE KEEP'S OWN NAME ON ITS COMMITS: a keep's remote crosses to another vessel, so its commits carry this fixed neutral author
 * and committer, never the host's ambient git identity (a name and an address that tie the bundle to one human's account). The
 * commit and the rebase that replays it both name it, through `-c`, so no config of the host's speaks in either.
 */
export const KEEP_AUTHOR = { name: "Lares Keep", email: "keep@lares.invalid" } as const;
const KEEP_IDENTITY: readonly string[] = ["-c", `user.name=${KEEP_AUTHOR.name}`, "-c", `user.email=${KEEP_AUTHOR.email}`];

export interface GitAnswer { readonly code: number; readonly stdout: string; readonly stderr: string }

export interface KeepHostPorts {
  /** The workspace's directory as THIS machine reads it; throws a refusal by name where none stands. */
  workspaceDir(name: string): string;
  /** One vessel row: the vessel half (`keep-cut`), a return over the standing bundle (`begin`), conferre's read (`receipts`), or a landing (`land`). */
  row(verb: "keep-cut" | "begin" | "receipts" | "land", args: Record<string, unknown>): Promise<RiteVerbAnswer>;
  /**
   * Where this device's Claude Code sessions stand (`./keep-sessions.ts`); null keeps none. Left unseated, the house config
   * decides (`configuredKeepSessions`) and the sources read this process's own environment.
   */
  readonly sessions?: SessionSources | null;
  /**
   * The keep line as `lares lei show rite=keep branch=<name> [face=N] json=true` reads it (one `{ lei }`, or `{ faces }`),
   * asked FIRST, so a spent lei refuses in seconds, before the mirror, the scan or the flush. Absent, the vessel half decides alone.
   */
  leiShow?(branch: string, face?: number): Promise<RiteVerbAnswer>;
  /** git in `dir`; never throws. */
  git(dir: string, argv: readonly string[]): Promise<GitAnswer>;
  say(line: string): void;
  /** Where a spent keep lei is offered its refill inline (a real terminal); absent, the refusal stands and names the plain line. */
  refill?: RefillPort;
  /**
   * The shore's flush before the cut, through the hand door (`lares shore flush`): every island that mounts a disk shore. Null
   * where the door answered no reading; absent, the keep asks none.
   */
  flush?: () => Promise<ShoreFlushReading | null>;
}

/** The keep's lines over the shore's flush: what each island wrote or left. */
export function keepFlushLines(reading: ShoreFlushReading | null): string[] {
  if (reading === null) return ["keep: the shore's flush answered nothing (`lares shore flush` reads it); the keep goes on"];
  const lines = reading.islands.map((p) => !p.answered
    ? `keep: the shore's flush: ${p.island} did not answer: ${p.refusal}: ${p.why}`
    : `keep: the shore's flush: ${p.island} wrote ${p.writtenCount} owed carrier(s)${p.unwrittenCount > 0 ? `; ${p.unwrittenCount} left unwritten: ${p.unwritten.map((u) => `${String(u["state"])} ${String(u["uri"])} (${String(u["why"])})`).join("; ")}` : ""}`);
  if (reading.islands.length === 0) lines.push("keep: the shore's flush: no island mounts a disk shore");
  if (!reading.whole) lines.push("keep: the bundle cuts from the records, and those mirrors stay behind until a flush writes them; the keep goes on");
  return lines;
}

export interface KeepHostOptions {
  readonly workspace: string; readonly into?: string; readonly acceptOmissions?: boolean; readonly face?: number; readonly ifDue?: boolean;
  /** `--sessions` / `--no-sessions`: whether the device's sessions ride this keep; unnamed, the ports and the house config decide. */
  readonly sessions?: boolean;
}
export interface KeepHostOutcome { readonly code: number; readonly data: Record<string, unknown> }

/** A refusal the host half raises by name; the message carries the cure. */
class HostRefused extends Error {
  constructor(readonly code: string, message: string, readonly extra: Record<string, unknown> = {}) { super(codedMessage(code, message)); }
}

/** A secret-shaped match by its FAMILY name alone: no character of the secret itself ever prints (a secret never transcludes). */
function shapeFamily(raw: string): string {
  if (raw.startsWith("sk-ant-")) return "anthropic-key";
  if (/^gh[pousr]_/.test(raw) || raw.startsWith("github_pat_")) return "github-token";
  if (raw.startsWith("AKIA")) return "aws-access-key";
  if (raw.startsWith("xox")) return "slack-token";
  if (/PRIVATE KEY/.test(raw)) return "private-key";
  if (/secret_access_key|SecretAccessKey/i.test(raw)) return "aws-secret-key";
  return "secret-shaped";
}

const under = (path: string, into: string): boolean => path === into || path.startsWith(`${into}/`);

/** The paths `git status` names as changed, staged or untracked: both names of a rename or a copy. */
function changedPaths(porcelainZ: string): string[] {
  const parts = porcelainZ.split("\0").filter((p) => p !== "");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]!, xy = entry.slice(0, 2);
    out.push(entry.slice(3));
    if (xy.includes("R") || xy.includes("C")) out.push(parts[++i] ?? "");
  }
  return out;
}

/**
 * The directory one workspace name binds to in a LARES_WORKSPACES value (`;`-separated `<name>=<dir>` pairs, as the shim reads
 * them), or a refusal by name: the host half finds the very directory the shim binds at `/lar/workspaces/<name>`.
 */
export function workspaceFromPairs(name: string, configured: string): string {
  for (const pair of configured.split(";")) {
    const at = pair.indexOf("=");
    if (at > 0 && pair.slice(0, at).trim() === name) {
      const dir = pair.slice(at + 1).trim();
      if (dir.startsWith("/")) return dir;
    }
  }
  throw new KeepRefused("keep-workspace-unnamed-on-host", `LARES_WORKSPACES names no directory for the workspace "${name}" on this host; name it there (\`${name}=<dir>\`, in the environment or ~/.lares/lares-surface.env), so the host half and the vessel read one clone`);
}

/**
 * The row codes that read as no vessel answering at all: the row reached nothing (`rite-row-unreached`), or reached a store
 * with no standing daemon. The keep lei rests in that vessel's store, so none of these spends a return.
 */
export const KEEP_VESSEL_UNREACHED: ReadonlySet<string> = new Set(["rite-row-unreached", "swarm-no-daemon", "daemon-unreachable", "vessel-silent", "store-door-timeout"]);
export const KEEP_VESSEL_DOWN = "the keep lei lives in the vessel; up, then keep";


export async function riteKeepHost(ports: KeepHostPorts, opts: KeepHostOptions): Promise<KeepHostOutcome> {
  const name = opts.workspace, into = opts.into ?? KEEP_INTO;
  const base: Record<string, unknown> = { rite: RITE_KEEP, workspace: name, into };
  // THE FACE: the one the line names rides the cut; naming none, the vessel half acts as the daemon mount and names it, and
  // every row after the cut rides the face the cut acted as.
  let face: { face?: number } = opts.face === undefined ? {} : { face: opts.face };
  let stage = "guard";
  try {
    const unsafe = unsafeRelPath(into);
    if (unsafe !== null || into.split("/").some((s) => s.startsWith("."))) throw new HostRefused("keep-into-unsafe", `into=${JSON.stringify(into)} names ${unsafe ?? "a dotted segment"}; it names a plain relative place inside the workspace`);
    if (under(into, DEVICES_DIR) || under(DEVICES_DIR, into)) throw new HostRefused("keep-into-unsafe", `into=${JSON.stringify(into)} crosses ${DEVICES_DIR}/, where each device's sessions rest; name another place`);
    const dir = ports.workspaceDir(name);
    // THE DEVICE'S SESSIONS: on unless the line, the ports or the house config say otherwise. The identity reads (or mints)
    // before the guard, so the guard knows the one device dir it allows.
    const sessionsOn = opts.sessions ?? (ports.sessions !== undefined ? ports.sessions !== null : configuredKeepSessions());
    // The sources stand even where the mirror rests: the device's dir already in the workspace belongs to this keep either way.
    const sources = ports.sessions === null ? null : (ports.sessions ?? sessionSources());
    let device: KeepDevice | null = null;
    if (sources !== null) { if (sessionsOn) device = readOrMintDevice(sources); else { try { device = readDevice(sources); } catch { device = null; } } }
    // Where the mirror rests, the device dir stands as this keep's; where it does not, the dir counts only if the workspace already holds it.
    const devRel = device === null || (!sessionsOn && !existsSync(join(dir, DEVICES_DIR, device.dir))) ? null : `${DEVICES_DIR}/${device.dir}`;
    const kept2 = devRel === null ? `${into}/` : `${into}/ and ${devRel}/`;
    const git = async (argv: readonly string[], refusal?: string): Promise<string> => {
      const r = await ports.git(dir, argv);
      if (r.code !== 0 && refusal !== undefined) throw new HostRefused(refusal, `git ${argv.join(" ")} answered ${r.code}: ${r.stderr.trim() || r.stdout.trim()}`);
      return r.code === 0 ? r.stdout.trim() : "";
    };

    // ── 1. THE GUARD, before anything spends ──────────────────────────────────────────────────────────────────
    const top = await ports.git(dir, ["rev-parse", "--show-toplevel"]);
    if (top.code !== 0) throw new HostRefused("keep-workspace-not-a-repo", `the workspace "${name}" (${dir}) holds no git repo; clone the operator's private repo there`);
    const branch = await git(["symbolic-ref", "-q", "--short", "HEAD"]);
    if (branch === "") throw new HostRefused("keep-workspace-detached", `the workspace "${name}" stands on no branch; check one out (git -C ${dir} switch <branch>)`);
    const remote = (await git(["config", "--get", `branch.${branch}.remote`])) || "origin";
    if ((await ports.git(dir, ["remote", "get-url", remote])).code !== 0) throw new HostRefused("keep-remote-absent", `the workspace "${name}" names no remote "${remote}" for ${branch}; add the operator's repo (git -C ${dir} remote add ${remote} <url>)`);
    const attr = await git(["check-attr", "text", "--", `${into}/${MANIFEST_FILE}`], "keep-attributes-unread");
    if (!/: text: unset$/.test(attr)) throw new HostRefused("keep-text-guard-absent", `${into}/ reads \`text\` as ${attr.split(": ").pop() || "unspecified"} in the workspace "${name}"; a line-ending rewrite would move bytes the manifest hashes. Commit a .gitattributes holding \`* -text\` at the workspace's top first`);
    // The status reads raw: its first column may stand blank (` M <path>`), and a trim would eat it and the path's first letter.
    const outside = async (): Promise<string[]> => {
      const st = await ports.git(dir, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
      if (st.code !== 0) throw new HostRefused("keep-status-unread", `git status answered ${st.code}: ${st.stderr.trim() || st.stdout.trim()}`);
      return changedPaths(st.stdout).filter((p) => !under(p, into) && !(devRel !== null && under(p, devRel)));
    };
    const before = await outside();
    if (before.length > 0) throw new HostRefused("keep-tree-unclean", `the workspace "${name}" holds changes outside ${kept2} (${before.slice(0, 5).join(", ")}${before.length > 5 ? ", …" : ""}); commit or clear them first, since a keep commits ${kept2} alone`, { outside: before });
    /** The secret-shaped strings among the files git reads as new or changed under one place, each by its path. */
    const scan = async (place: string, textOf: (rel: string) => string | null): Promise<{ rel: string; shape: string }[]> => {
      const found: { rel: string; shape: string }[] = [];
      for (const rel of (await git(["ls-files", "-mo", "--exclude-standard", "-z", "--", place], "keep-status-unread")).split("\0").filter((p) => p !== "")) {
        const text = textOf(rel);
        const shapes = text === null ? [] : secretShapes(text);
        if (shapes.length > 0) found.push({ rel, shape: shapeFamily(shapes[0]!) });
      }
      return found;
    };

    // ── 1b. THE KEEP LEI, before the mirror, the scan and the flush spend their minutes ────────────────────────
    if (ports.leiShow) {
      let spent = keepLeiGate(await ports.leiShow(name, opts.face), name, opts.face);
      if (spent !== null && ports.refill) {
        // A SPENT KEEP LEI OFFERS ITS OWN REFILL on a terminal; the keep goes on once strung.
        const returns = /\breturns=(\d+)/.exec(spent.message)?.[1], at = /\bface=(\d+)/.exec(spent.message)?.[1];
        const again = await ports.refill({ rite: "keep", branch: name, ...(returns ? { returns: Number(returns) } : {}), ...(at ? { face: Number(at) } : opts.face !== undefined ? { face: opts.face } : {}) });
        if (again.strung) spent = keepLeiGate(await ports.leiShow(name, opts.face), name, opts.face);
      }
      if (spent !== null) throw new HostRefused(spent.code, spent.message);
    }

    // ── 2. THE SESSIONS, on the host, before anything spends ──────────────────────────────────────────────────
    let sessionsMoved = false;
    // THE WITHHELD: a device file that reads secret-shaped stays out of the commit, in place; the rest of the keep goes on.
    const withheld: string[] = [];
    if (sources !== null && device !== null && devRel !== null) {
      if (sessionsOn) {
        const mirrored = mirrorSessions(sources, dir, device);
        for (const f of mirrored.unpacked) ports.say(`keep: the transcript ${f} did not compress; it waits for the next keep`);
      }
      // A compressed transcript reads by the bytes it unpacks to; a file that left, or a nested repo's own dir, reads as none.
      const hits = await scan(devRel, (rel) => {
        const abs = join(dir, rel);
        try { if (!statSync(abs).isFile()) return null; } catch { return null; }
        return (rel.endsWith(".zst") ? sources.unzstd(abs) : readFileSync(abs)).toString("latin1");
      });
      for (const h of hits) withheld.push(h.rel);
      if (hits.length > 0) {
        const named = hits.slice(0, 8).map((h) => `${h.rel} (${h.shape})`).join(", ") + (hits.length > 8 ? `, … (${hits.length} files)` : "");
        ports.say(`keep: withheld from the commit, secret-shaped, left in place: ${named}; clear each at its source under ${sources.claudeHome} (the mirror follows), and a later keep carries it`);
      }
      const st = await ports.git(dir, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", devRel]);
      if (st.code !== 0) throw new HostRefused("keep-status-unread", `git status answered ${st.code}: ${st.stderr.trim() || st.stdout.trim()}`);
      sessionsMoved = changedPaths(st.stdout).some((p) => !withheld.includes(p));
      base["sessions"] = { device: devRel, moved: sessionsMoved, ...(withheld.length > 0 ? { withheld } : {}) };
    }

    // ── 3. THE VESSEL HALF ────────────────────────────────────────────────────────────────────────────────────
    stage = "keep";
    if (ports.flush) {
      const flushed = await ports.flush();
      for (const line of keepFlushLines(flushed)) ports.say(line);
      if (flushed !== null) base["shore"] = flushed;
    }
    const cutRow = (): Promise<RiteVerbAnswer> => ports.row("keep-cut", { workspace: name, into, ...(opts.acceptOmissions === true ? { "accept-omissions": true } : {}), ...face });
    let cut = await cutRow();
    if (!cut.ok && cut.code === RETURNS_SPENT && ports.refill) {
      // A SPENT KEEP LEI OFFERS ITS OWN REFILL on a terminal (the returns and the face the refusal names), then the keep goes on once.
      const returns = /\breturns=(\d+)/.exec(cut.message)?.[1], at = /\bface=(\d+)/.exec(cut.message)?.[1];
      const again = await ports.refill({ rite: "keep", branch: name, ...(returns ? { returns: Number(returns) } : {}), ...(at ? { face: Number(at) } : face.face !== undefined ? { face: face.face } : {}) });
      if (again.strung) cut = await cutRow();
    }
    if (!cut.ok) throw new HostRefused(cut.code, KEEP_VESSEL_UNREACHED.has(cut.code) ? `${KEEP_VESSEL_DOWN} (${cut.message}). No return spent, and nothing commits or pushes${sessionsMoved ? `; the sessions rest mirrored in ${devRel!}/ for the keep that follows` : ""}` : cut.message);
    const actedAs = cut.output["face"];
    if (typeof actedAs === "number" && Number.isSafeInteger(actedAs)) {
      face = { face: actedAs };
      const by = cut.output["faceBy"] === "keep" ? "keep" : "named";
      Object.assign(base, { face: actedAs, faceBy: by });
      if (by === "keep") ports.say(`keep: ${keepFaceLine(actedAs)}`);
    } else if (opts.face !== undefined) Object.assign(base, { face: opts.face, faceBy: "named" });
    const kept = cut.output["kept"] === true;
    const bundleId = String(cut.output["bundleId"]);
    const tessera = kept ? String(cut.output["tessera"]) : null;
    Object.assign(base, { bundleId, kept, ...(tessera !== null ? { tessera } : {}) });
    ports.say(kept ? `keep: the vessel cut bundle ${bundleId.slice(0, 16)} into ${into}/ and spent a return (tessera ${tessera})` : `keep: ${into}/ already holds bundle ${bundleId.slice(0, 16)}; the vessel spent nothing`);

    /** The keep tesserae conferre reads begun and never landed at this workspace and bundle: each names a return already spent. */
    const owedAt = async (): Promise<string[]> => {
      const read = await ports.row("receipts", { ...face });
      if (!read.ok) throw new HostRefused(read.code, read.message);
      const red = ((read.output["conferre"] as { red?: { tessera: string; rite: string | null; red?: string; branch?: string; head?: string }[] } | undefined)?.red ?? []);
      return red.filter((t) => t.rite === RITE_KEEP && t.red === "landed-absent" && t.branch === name && t.head === bundleId).map((t) => t.tessera);
    };

    // ── 4. THE GUARD over what the cut left ───────────────────────────────────────────────────────────────────
    stage = "guard";
    let seen: unknown = null;
    try { seen = (JSON.parse(readFileSync(join(dir, ...into.split("/"), MANIFEST_FILE), "utf8")) as { bundleId?: unknown }).bundleId; } catch { seen = null; }
    if (seen !== bundleId) throw new HostRefused("keep-workspace-differs", `the vessel cut bundle ${bundleId} and ${join(dir, into)} holds ${seen === null ? "no bundle" : String(seen)}; the host's workspace "${name}" and the vessel's stand as two directories`);
    const after = await outside();
    if (after.length > 0) throw new HostRefused("keep-tree-unclean", `the keep left changes outside ${kept2} (${after.slice(0, 5).join(", ")}); nothing commits`, { outside: after });
    const hits = (await scan(into, (rel) => { try { return readFileSync(join(dir, rel), "utf8"); } catch { return null; } })).map((h) => `${h.rel} (${h.shape})`);
    if (hits.length > 0) throw new HostRefused("keep-secret-shaped", `the bundle holds secret-shaped strings: ${hits.join(", ")}; nothing commits. Inspect them, clear the record from the house, and keep again`, { secrets: hits });

    // ── IF DUE: an unmoved house whose bundle the remote-tracking branch holds, with nothing owed, stops here ──────
    if (opts.ifDue === true) {
      let due = kept || sessionsMoved;
      if (!due) {
        const tracking = `refs/remotes/${remote}/${branch}`;
        let held: unknown = null;
        try { held = (JSON.parse(await git(["show", `${tracking}:${into}/${MANIFEST_FILE}`])) as { bundleId?: unknown }).bundleId; } catch { held = null; }
        if (held !== bundleId) due = true;
        else {
          due = (await owedAt()).length > 0;
        }
      }
      base["due"] = due;
      if (!due) {
        ports.say(`keep: the house has not moved since bundle ${bundleId.slice(0, 16)}, which ${remote}/${branch} already holds${devRel !== null ? `, and no session file moved under ${devRel}/` : ""}; nothing spent, committed or pushed`);
        return { code: 0, data: { ...base, committed: false, pushed: false, landed: [], par: true } };
      }
    }

    // ── 5. THE RETURN the sessions ride where the cut spent none ──────────────────────────────────────────────
    // An unmoved house spends nothing in the cut, and no push leaves without a spent return. A return a keep already spent at
    // this bundle and never landed (a cut never pushed, a push that failed) carries the sessions too; with none owed, the
    // vessel reads the standing bundle itself, returns the keep lei at its id, and rests a tessera the landing below closes.
    if (!kept && sessionsMoved) {
      stage = "sessions";
      const waits = await owedAt();
      if (waits.length > 0) {
        base["sessions"] = { device: devRel, moved: true, spent: false, rides: waits[0] };
        ports.say(`keep: the sessions moved over an unmoved house; they ride the return tessera ${waits[0]!} spent and never landed`);
      } else {
        const begun = await ports.row("begin", { rite: RITE_KEEP, branch: name, head: bundleId, staging: into, ...face });
        if (!begun.ok) throw new HostRefused(begun.code, `${KEEP_VESSEL_UNREACHED.has(begun.code) ? `${KEEP_VESSEL_DOWN} (${begun.message})` : begun.message}. The sessions rest mirrored in ${devRel!}/ with no return spent, so nothing commits or pushes; with a keep lei holding a return (\`lares lei show rite=${RITE_KEEP} branch=${name}\`), run the rite again`);
        base["sessions"] = { device: devRel, moved: true, spent: true, tessera: String(begun.output["tessera"]) };
        ports.say(`keep: the sessions moved over an unmoved house; a return spent for them (tessera ${String(begun.output["tessera"])})`);
      }
    }

    // ── 6. GIT: one commit, rebase, one push ──────────────────────────────────────────────────────────────────
    stage = "commit";
    await git(["add", "-A", "--", into, ...(devRel !== null ? [devRel, ...withheld.map((w) => `:(exclude,literal)${w}`)] : [])], "keep-commit-refused");
    const staged = (await ports.git(dir, ["diff", "--cached", "--quiet"])).code !== 0;
    if (staged) await git([...KEEP_IDENTITY, "commit", "-q", `--author=${KEEP_AUTHOR.name} <${KEEP_AUTHOR.email}>`, "-m", `keep ${bundleId}`], "keep-commit-refused");
    base["committed"] = staged;
    stage = "push";
    await git(["fetch", "-q", remote], "keep-push-refused");
    const upstream = `refs/remotes/${remote}/${branch}`;
    const tracked = (await ports.git(dir, ["rev-parse", "--verify", "-q", upstream])).code === 0;
    if (tracked) {
      const rebased = await ports.git(dir, [...KEEP_IDENTITY, "rebase", "-q", "--autostash", upstream]);
      if (rebased.code !== 0) {
        await ports.git(dir, ["rebase", "--abort"]);
        throw new HostRefused("keep-rebase-refused", `the keep commit does not rebase onto ${remote}/${branch} (${rebased.stderr.trim()}); the workspace stands as the commit left it. Settle ${remote}/${branch} by hand, then run the rite again`);
      }
    }
    const ahead = !tracked || Number(await git(["rev-list", "--count", `${upstream}..HEAD`], "keep-push-refused")) > 0;
    if (ahead) await git(["push", "-q", remote, `HEAD:refs/heads/${branch}`], "keep-push-refused");
    base["pushed"] = ahead;

    // ── 7. LAND at the bundle id the pushed tree holds ────────────────────────────────────────────────────────
    stage = "land";
    const remoteHead = (await git(["ls-remote", remote, `refs/heads/${branch}`], "keep-push-refused")).split(/\s+/)[0] ?? "";
    let pushed: unknown = null;
    try { pushed = (JSON.parse(await git(["show", `${remoteHead}:${into}/${MANIFEST_FILE}`], "keep-pushed-unread")) as { bundleId?: unknown }).bundleId; } catch (e) { if (e instanceof HostRefused) throw e; }
    if (pushed !== bundleId) throw new HostRefused("keep-pushed-differs", `${remote}/${branch} holds bundle ${String(pushed)} at ${into}/, not the ${bundleId} this keep cut; no landing writes, since a landing writes once. Settle ${remote}/${branch}, then run the rite again`);
    const owed = tessera !== null ? [tessera] : await owedAt();
    const landed: { tessera: string; par: boolean }[] = [];
    for (const t of owed) {
      const l = await ports.row("land", { tessera: t, head: pushed, ...face });
      if (!l.ok) throw new HostRefused(l.code, `the landing of tessera ${t} refused: ${l.message}`, { landed });
      landed.push({ tessera: t, par: l.output["par"] === true });
    }
    const par = landed.every((l) => l.par);
    ports.say(!staged && !ahead && landed.length === 0 ? `keep: ${remote}/${branch} already holds bundle ${bundleId.slice(0, 16)}; nothing committed, pushed or landed`
      : `keep: ${staged ? "committed, " : ""}${ahead ? `pushed to ${remote}/${branch}, ` : ""}${landed.length} tessera${landed.length === 1 ? "" : "e"} landed${par ? "; conferre reads par" : "; conferre reads red"}`);
    return { code: par ? 0 : 1, data: { ...base, landed, par } };
  } catch (err) {
    if (!(err instanceof HostRefused) && !(err instanceof KeepRefused) && !(err instanceof SessionsRefused)) throw err;
    const extra = err instanceof HostRefused ? err.extra : {};
    const t = base["tessera"] as string | undefined, id = base["bundleId"] as string | undefined;
    // THE LANDING NAMES ITS FACE: the half rests under the face the cut acted as (the keep's face where none was named), so a
    // terminal wearing another face lands it only by naming that face.
    const at = typeof base["face"] === "number" ? ` face=${base["face"]}` : "";
    const cure = stage === "push" || stage === "land"
      ? ` The bundle rests in the workspace and ${t !== undefined ? `tessera ${t} reads red (landed-absent)` : "any tessera it owes reads red"}: mend the remote and run \`lares rite keep workspace=${name}${opts.into !== undefined ? ` into=${into}` : ""}\` again (it pushes what waits and lands it)${t !== undefined && id !== undefined ? `, or by hand: git push, then \`lares rite land tessera=${t} head=${id}${at}\`` : ""}.`
      : stage === "guard" && t !== undefined ? ` The return stays spent and tessera ${t} reads red until a keep lands it.`
      : stage === "commit" && (base["sessions"] as { tessera?: string } | undefined)?.tessera !== undefined ? ` The return the sessions spent stays spent, and tessera ${(base["sessions"] as { tessera: string }).tessera} reads red until a keep lands it.` : "";
    const message = `${err.message}${cure}`;
    ports.say(`keep: ${message}`);
    return { code: 1, data: { ...base, ...extra, stopped: stage, refusal: err.code, message } };
  }
}
