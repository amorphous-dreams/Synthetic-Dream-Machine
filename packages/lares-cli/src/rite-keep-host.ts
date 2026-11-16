/**
 * rite-keep-host — the keep rite's host half: the bundle the vessel laid into a bound workspace goes into the operator's repo,
 * and the tessera lands at the bundle id the pushed tree holds.
 *
 * git runs on the host (the workspace is a clone of the operator's own private repo), so the commit, the rebase and the push
 * belong here, as kūkulu's shim verbs do. The rite runs behind three ports, in one order:
 *
 *   1. the guard     the workspace stands as a repo at its top, on a branch with a remote; `<into>` reads `-text` (a
 *                    `.gitattributes` with `* -text` stands), so no line-ending rewrite moves a byte the manifest hashes;
 *                    and nothing outside `<into>` stands changed. A guard that refuses spends nothing.
 *   2. keep-cut      IN THE VESSEL: the vessel half (`rite-keep.ts`): the lei's return, the cut, the guest half
 *   3. the guard     again over what the cut left: only `<into>` changed, the manifest the host reads names the vessel's bundle
 *                    id (the host's directory and the vessel's stand as one), and the secret scan finds nothing
 *   4. git           `git add <into>`, commit `keep <bundleId>`, fetch, rebase onto the upstream, push
 *   5. rite-land     IN THE VESSEL: land each keep tessera owed at the bundle id read from the PUSHED manifest; conferre
 *                    reads it par
 *
 * A PUSH THAT FAILS leaves the tessera red (`landed-absent`) and names the cure: mend the remote and run the rite again. A
 * second run finds the bundle standing, pushes the commit that waits, and lands every keep tessera conferre reads open at
 * that bundle id. An unchanged keep commits nothing, pushes nothing and lands nothing.
 *
 * `--if-due` (the call `down` makes): a house that has not moved since the bundle its remote-tracking branch already holds, with
 * no keep tessera owed at that bundle, stops after the cut: no fetch, no push, no landing, nothing spent (`due: false`). A
 * moved house, or a bundle that still waits for its push or its landing, keeps as a plain keep does (`due: true`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MANIFEST_FILE, unsafeRelPath } from "./carry-manifest.js";
import { KEEP_INTO, KeepRefused, RITE_KEEP } from "./rite-keep.js";
import type { RiteRowAnswer } from "./rite-kukulu.js";

/**
 * The secret-shaped strings no keep pushes, the same list the operator's claude-backup sync scans with: an Anthropic key, a
 * GitHub token, an AWS access key id, a PEM private key, a Slack token.
 */
export const KEEP_SECRET_PATTERN = /(sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-[A-Za-z0-9-]{10,})/g;
/** Known fixtures a match may hold and still pass: the AWS documentation key, and the house's PLANTED test values. */
export const KEEP_SECRET_ALLOW: readonly string[] = ["AKIAIOSFODNN7EXAMPLE", "PLANTED"];

export interface GitAnswer { readonly code: number; readonly stdout: string; readonly stderr: string }

export interface KeepHostPorts {
  /** The workspace's directory as THIS machine reads it; throws a refusal by name where none stands. */
  workspaceDir(name: string): string;
  /** One vessel row: the vessel half (`keep-cut`), conferre's read (`receipts`), or a landing (`land`). */
  row(verb: "keep-cut" | "receipts" | "land", args: Record<string, unknown>): Promise<RiteRowAnswer>;
  /** git in `dir`; never throws. */
  git(dir: string, argv: readonly string[]): Promise<GitAnswer>;
  say(line: string): void;
}

export interface KeepHostOptions { readonly workspace: string; readonly into?: string; readonly acceptOmissions?: boolean; readonly face?: number; readonly ifDue?: boolean }
export interface KeepHostOutcome { readonly code: number; readonly data: Record<string, unknown> }

/** A refusal the host half raises by name; the message carries the cure. */
class HostRefused extends Error {
  constructor(readonly code: string, message: string, readonly extra: Record<string, unknown> = {}) { super(`${code}: ${message}`); }
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

/** The secret-shaped strings one text holds, the allowed fixtures dropped. */
export function secretShapes(text: string): string[] {
  return [...text.matchAll(KEEP_SECRET_PATTERN)].map((m) => m[0]).filter((m) => !KEEP_SECRET_ALLOW.some((a) => m.includes(a)));
}

export async function riteKeepHost(ports: KeepHostPorts, opts: KeepHostOptions): Promise<KeepHostOutcome> {
  const name = opts.workspace, into = opts.into ?? KEEP_INTO;
  const base: Record<string, unknown> = { rite: RITE_KEEP, workspace: name, into };
  const face = opts.face === undefined ? {} : { face: opts.face };
  let stage = "guard";
  try {
    const unsafe = unsafeRelPath(into);
    if (unsafe !== null || into.split("/").some((s) => s.startsWith("."))) throw new HostRefused("keep-into-unsafe", `--into ${JSON.stringify(into)} names ${unsafe ?? "a dotted segment"}; it names a plain relative place inside the workspace`);
    const dir = ports.workspaceDir(name);
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
      return changedPaths(st.stdout).filter((p) => !under(p, into));
    };
    const before = await outside();
    if (before.length > 0) throw new HostRefused("keep-tree-unclean", `the workspace "${name}" holds changes outside ${into}/ (${before.slice(0, 5).join(", ")}${before.length > 5 ? ", …" : ""}); commit or clear them first, since a keep commits ${into}/ alone`, { outside: before });

    // ── 2. THE VESSEL HALF ────────────────────────────────────────────────────────────────────────────────────
    stage = "keep";
    const cut = await ports.row("keep-cut", { workspace: name, into, ...(opts.acceptOmissions === true ? { "accept-omissions": true } : {}), ...face });
    if (!cut.ok) throw new HostRefused(cut.code, cut.message);
    const kept = cut.output["kept"] === true;
    const bundleId = String(cut.output["bundleId"]);
    const tessera = kept ? String(cut.output["tessera"]) : null;
    Object.assign(base, { bundleId, kept, ...(tessera !== null ? { tessera } : {}) });
    ports.say(kept ? `keep: the vessel cut bundle ${bundleId.slice(0, 16)} into ${into}/ and spent a return (tessera ${tessera})` : `keep: ${into}/ already holds bundle ${bundleId.slice(0, 16)}; the vessel spent nothing`);

    // ── 3. THE GUARD over what the cut left ───────────────────────────────────────────────────────────────────
    stage = "guard";
    let seen: unknown = null;
    try { seen = (JSON.parse(readFileSync(join(dir, ...into.split("/"), MANIFEST_FILE), "utf8")) as { bundleId?: unknown }).bundleId; } catch { seen = null; }
    if (seen !== bundleId) throw new HostRefused("keep-workspace-differs", `the vessel cut bundle ${bundleId} and ${join(dir, into)} holds ${seen === null ? "no bundle" : String(seen)}; the host's workspace "${name}" and the vessel's stand as two directories`);
    const after = await outside();
    if (after.length > 0) throw new HostRefused("keep-tree-unclean", `the keep left changes outside ${into}/ (${after.slice(0, 5).join(", ")}); nothing commits`, { outside: after });
    const hits: string[] = [];
    for (const rel of (await git(["ls-files", "-mo", "--exclude-standard", "-z", "--", into], "keep-status-unread")).split("\0").filter((p) => p !== "")) {
      let text: string;
      try { text = readFileSync(join(dir, rel), "utf8"); } catch { continue; }
      const found = secretShapes(text);
      if (found.length > 0) hits.push(`${rel} (${found[0]!.slice(0, 8)}…)`);
    }
    if (hits.length > 0) throw new HostRefused("keep-secret-shaped", `the bundle holds secret-shaped strings: ${hits.join(", ")}; nothing commits. Inspect them, clear the record from the house, and keep again`, { secrets: hits });

    // ── IF DUE: an unmoved house whose bundle the remote-tracking branch holds, with nothing owed, stops here ──────
    if (opts.ifDue === true) {
      let due = kept;
      if (!due) {
        const tracking = `refs/remotes/${remote}/${branch}`;
        let held: unknown = null;
        try { held = (JSON.parse(await git(["show", `${tracking}:${into}/${MANIFEST_FILE}`])) as { bundleId?: unknown }).bundleId; } catch { held = null; }
        if (held !== bundleId) due = true;
        else {
          const read = await ports.row("receipts", { ...face });
          if (!read.ok) throw new HostRefused(read.code, read.message);
          const red = ((read.output["conferre"] as { red?: { rite: string | null; red?: string; branch?: string; head?: string }[] } | undefined)?.red ?? []);
          due = red.some((t) => t.rite === RITE_KEEP && t.red === "landed-absent" && t.branch === name && t.head === bundleId);
        }
      }
      base["due"] = due;
      if (!due) {
        ports.say(`keep: the house has not moved since bundle ${bundleId.slice(0, 16)}, which ${remote}/${branch} already holds; nothing spent, committed or pushed`);
        return { code: 0, data: { ...base, committed: false, pushed: false, landed: [], par: true } };
      }
    }

    // ── 4. GIT: commit, rebase, push ──────────────────────────────────────────────────────────────────────────
    stage = "commit";
    await git(["add", "-A", "--", into], "keep-commit-refused");
    const staged = (await ports.git(dir, ["diff", "--cached", "--quiet"])).code !== 0;
    if (staged) await git(["commit", "-q", "-m", `keep ${bundleId}`], "keep-commit-refused");
    base["committed"] = staged;
    stage = "push";
    await git(["fetch", "-q", remote], "keep-push-refused");
    const upstream = `refs/remotes/${remote}/${branch}`;
    const tracked = (await ports.git(dir, ["rev-parse", "--verify", "-q", upstream])).code === 0;
    if (tracked) {
      const rebased = await ports.git(dir, ["rebase", "-q", upstream]);
      if (rebased.code !== 0) {
        await ports.git(dir, ["rebase", "--abort"]);
        throw new HostRefused("keep-rebase-refused", `the keep commit does not rebase onto ${remote}/${branch} (${rebased.stderr.trim()}); the workspace stands as the commit left it. Settle ${remote}/${branch} by hand, then run the rite again`);
      }
    }
    const ahead = !tracked || Number(await git(["rev-list", "--count", `${upstream}..HEAD`], "keep-push-refused")) > 0;
    if (ahead) await git(["push", "-q", remote, `HEAD:refs/heads/${branch}`], "keep-push-refused");
    base["pushed"] = ahead;

    // ── 5. LAND at the bundle id the pushed tree holds ────────────────────────────────────────────────────────
    stage = "land";
    const remoteHead = (await git(["ls-remote", remote, `refs/heads/${branch}`], "keep-push-refused")).split(/\s+/)[0] ?? "";
    let pushed: unknown = null;
    try { pushed = (JSON.parse(await git(["show", `${remoteHead}:${into}/${MANIFEST_FILE}`], "keep-pushed-unread")) as { bundleId?: unknown }).bundleId; } catch (e) { if (e instanceof HostRefused) throw e; }
    if (pushed !== bundleId) throw new HostRefused("keep-pushed-differs", `${remote}/${branch} holds bundle ${String(pushed)} at ${into}/, not the ${bundleId} this keep cut; no landing writes, since a landing writes once. Settle ${remote}/${branch}, then run the rite again`);
    let owed: string[];
    if (tessera !== null) owed = [tessera];
    else {
      const read = await ports.row("receipts", { ...face });
      if (!read.ok) throw new HostRefused(read.code, read.message);
      const red = ((read.output["conferre"] as { red?: { tessera: string; rite: string | null; red?: string; branch?: string; head?: string }[] } | undefined)?.red ?? []);
      owed = red.filter((t) => t.rite === RITE_KEEP && t.red === "landed-absent" && t.branch === name && t.head === bundleId).map((t) => t.tessera);
    }
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
    if (!(err instanceof HostRefused) && !(err instanceof KeepRefused)) throw err;
    const extra = err instanceof HostRefused ? err.extra : {};
    const t = base["tessera"] as string | undefined, id = base["bundleId"] as string | undefined;
    const cure = stage === "push" || stage === "land"
      ? ` The bundle rests in the workspace and ${t !== undefined ? `tessera ${t} reads red (landed-absent)` : "any tessera it owes reads red"}: mend the remote and run \`lares rite keep --workspace ${name}${opts.into !== undefined ? ` --into ${into}` : ""}\` again (it pushes what waits and lands it)${t !== undefined && id !== undefined ? `, or by hand: git push, then \`lares rite land --tessera ${t} --head ${id}\`` : ""}.`
      : stage === "guard" && t !== undefined ? ` The return stays spent and tessera ${t} reads red until a keep lands it.` : "";
    const message = `${err.message}${cure}`;
    ports.say(`keep: ${message}`);
    return { code: 1, data: { ...base, ...extra, stopped: stage, refusal: err.code, message } };
  }
}
