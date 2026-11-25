/**
 * rite-keep-host — the keep rite's host half: the bundle the vessel laid into a bound workspace goes into the operator's repo
 * (here a bare scratch remote), and the tessera lands at the bundle id the pushed tree holds.
 *
 *   KH1  a workspace with changes outside `<into>` refuses before the vessel half runs: nothing spends;
 *   KH2  a workspace where `<into>` reads `text` (no `.gitattributes` holding `* -text`) refuses the same way;
 *   KH3  a push that fails leaves the tessera unlanded and names the cure; the rite run again, the remote mended, finds the
 *        bundle standing, pushes the commit that waits, and lands the very tessera conferre reads open at that bundle id;
 *   KH4  the full walk: commit `keep <id>`, push, land at the id read from the pushed manifest; par;
 *   KH5  CONTROL: an unchanged second keep commits nothing, pushes nothing and lands nothing;
 *   KH6  a bundle holding a secret-shaped string refuses and commits nothing; a PLANTED fixture passes;
 *   KH7  an upstream another clone moved rebases under the keep commit, and the push lands on top of it;
 *   KH8  beside the container house, the host finds the workspace in LARES_WORKSPACES, the pairs the shim binds.
 *   KH10 a moved house after a pushed keep keeps again: the status read keeps git's leading column, so a tracked file the
 *        new cut changed inside `<into>` reads inside it.
 *   KH9  keep-if-due-spends-nothing-on-an-unmoved-house: `--if-due` over a house that has not moved since the bundle its
 *        remote-tracking branch holds, with no keep tessera owed, stops after the cut: no fetch, no push, no landing, nothing
 *        spent; a moved house keeps as a plain keep does; `--if-due` with no workspace named reads the configured one.
 *
 * THE DEVICE'S SESSIONS ride the same keep (`../src/keep-sessions.ts`), mirrored from a scratch home:
 *
 *   KH11 one commit carries `house/` and `devices/<name>-<id8>/`, and one push carries that commit;
 *   KH12 the guard allows exactly `<into>` and this device's dir: another device's dir, changed, refuses before the vessel half
 *        runs, and so does this device's dir where its DEVICE.json names another uuid;
 *   KH13 a secret-shaped file in the mirror stays out of the commit (in place, named with its cure), in a plain
 *        file and inside a compressed transcript; a PLANTED fixture passes;
 *   KH14 with the vessel down the keep names where the lei lives, exits non-zero, commits nothing and pushes nothing (the
 *        mirror rests in the workspace for the keep that follows the `up`);
 *   KH15 sessions that moved over an unmoved house spend a return of their own (`begin` over the standing bundle) before
 *        anything commits; with no return left, nothing commits and nothing pushes; `--if-due` reads moved sessions as due;
 *   KH16 `sessions: false` (`--no-sessions`, LARES_KEEP_SESSIONS=0) keeps the house alone.
 *   KH17 a private-key header trips the guard only with key material after it (a base64 body of real length, in real lines,
 *        CRLF, or escaped `\n` inside JSONL): a header named in prose passes; the other shapes read as before;
 *   KH18 both guards (the sessions and the bundle) pass a header named in prose and refuse a planted header with its body.
 *
 * Real git over scratch repos; the vessel's rows answer from a recorded fake.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BUNDLE_SCHEMA, MANIFEST_FILE, bundleIdOf, sha256Hex, zeroCounts, type BundleFile } from "../src/bundle-manifest.js";
import { riteKeepHost, secretShapes, workspaceFromPairs, type GitAnswer, type KeepHostPorts } from "../src/rite-keep-host.js";
import { KeepRefused } from "../src/rite-keep.js";
import type { ShoreFlushReading } from "../src/shore-core.js";
import { readOrMintDevice, sessionSources, type SessionSources } from "../src/keep-sessions.js";
import { keepSessionsOn } from "../src/keep-config.js";
import { keepPlan } from "../src/commands/rite.js";
import { parseArgs } from "../src/parse-args.js";

let scratch: string, gitConfig: string;

/**
 * The four samples the operator's session mirror held where the keep refused (2026-11-19), verbatim as the JSONL bytes read:
 * a grep line, a transcript path, prose after a doubly escaped newline, and the header in discussion with no body. The header
 * splits (`${"-----"}`) so this file names no header itself.
 */
const MIRROR_SAMPLES: readonly string[] = [
  `${"-----"}BEGIN OPENSSH PRIVATE KEY-----\\npackages/lares-cli/src/rite-keep-host.ts:14: *                    A dir another device o`,
  `${"-----"}BEGIN OPENSSH PRIVATE KEY-----\\n-Dream-Machine/51e9b3fb-b3f5-4d7f-85a6-6102d371292f/subagents/agent-a027c23eb9d9a9f13.js`,
  `${"-----"}BEGIN OPENSSH PRIVATE KEY-----\\\\npackages/lares-cli/src/rite-keep-\\nthe key. It's \`~/.claude/projects/…/51e9b3fb…/subage`,
  Array.from({ length: 14 }, () => `${"-----"}BEGIN OPENSSH PRIVATE KEY-----\\\` in discussion with no key body after it`).join(" "),
];

function runGit(dir: string, argv: readonly string[]): GitAnswer {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_SYSTEM: "/dev/null" };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[k];
  const r = spawnSync("git", ["-C", dir, ...argv], { encoding: "utf8", env });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
const must = (dir: string, ...argv: string[]): string => {
  const r = runGit(dir, argv);
  expect(r.code, `git ${argv.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
};

/** A whole bundle at `dest`: every file hashed, the id over the file list. */
function writeBundle(dest: string, notes: Readonly<Record<string, string>>): string {
  rmSync(dest, { recursive: true, force: true });
  const files: BundleFile[] = [];
  for (const [name, text] of Object.entries(notes)) {
    const rel = `faces/f0/working/${name}.tid`, abs = join(dest, ...rel.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    files.push({ path: rel, sha256: sha256Hex(text), bytes: Buffer.byteLength(text) });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  const bundleId = bundleIdOf(files);
  writeFileSync(join(dest, MANIFEST_FILE), `${JSON.stringify({ schema: BUNDLE_SCHEMA, bundleId, faces: [{ key: "f0" }], files, rows: [], counts: zeroCounts(), tempBytes: {}, omissions: [] }, null, 2)}\n`);
  return bundleId;
}

/** A scratch home's Claude Code state, and the sources that read it: the device's sessions as the keep mirrors them. */
function fakeSessions(at: string): { sources: SessionSources; claude: string; put: (rel: string, text: string, ageSec?: number) => void } {
  const home = join(at, "home"), claude = join(home, ".claude");
  const put = (rel: string, text: string, ageSec = 3600): void => {
    const abs = join(claude, ...rel.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    const at = Date.now() / 1000 - ageSec;
    utimesSync(abs, at, at);
  };
  put("CLAUDE.md", "# the operator's rule\n");
  put("projects/-home-me-proj/memory/MEMORY.md", "# Memory Index\n");
  put("projects/-home-me-proj/aaaa.jsonl", '{"type":"user","text":"an idle transcript"}\n');
  writeFileSync(join(home, ".claude.json"), '{"userID": "u-123", "numStartups": 1}\n');
  writeFileSync(join(scratch, "machine-id"), "0123456789abcdef0123456789abcdef\n");
  return { sources: { ...sessionSources({ HOME: home, LARES_MACHINE_ID_FILE: join(scratch, "machine-id") }), hostname: () => "hale" }, claude, put };
}

/** The scratch remote, the workspace clone of it (guarded with `* -text` unless told not to), the device's sessions, and the vessel's rows. */
function rig(over: { guard?: boolean; at?: string } = {}) {
  const at = over.at ?? scratch;
  if (at !== scratch) mkdirSync(at, { recursive: true });
  const remote = join(at, "remote.git"), ws = join(at, "workspace");
  const sessions = fakeSessions(at);
  const device = `devices/${readOrMintDevice(sessions.sources).dir}`;
  mkdirSync(remote);
  must(remote, "init", "-q", "--bare");
  must(at, "clone", "-q", remote, ws);
  if (over.guard !== false) {
    writeFileSync(join(ws, ".gitattributes"), "* -text\n");
    must(ws, "add", ".gitattributes");
    must(ws, "commit", "-q", "-m", "guard");
    must(ws, "push", "-q", "origin", "HEAD:refs/heads/main");
  }
  const calls: string[] = [], said: string[] = [];
  const state = { notes: { heron: "remember the heron\n" } as Record<string, string>, n: 0, returns: 12, down: false, tesserae: [] as { tessera: string; head: string; landed: string | null }[] };
  const ports: KeepHostPorts = {
    sessions: sessions.sources,
    workspaceDir: (name) => { expect(name).toBe("backup"); return ws; },
    git: async (dir, argv) => runGit(dir, argv),
    say: (line) => { said.push(line); },
    row: async (verb, args) => {
      calls.push(`${verb} ${JSON.stringify(args)}`);
      if (state.down) return { ok: false, code: "rite-row-unreached", message: "the row answered no reading (exit 3)" };
      if (verb === "begin") {
        // The vessel reads the staged bundle itself and returns the keep lei at the id it derives.
        const standing = JSON.parse(readFileSync(join(ws, String(args["staging"]), MANIFEST_FILE), "utf8")).bundleId as string;
        if (args["rite"] !== "keep" || args["branch"] !== "backup" || standing !== args["head"]) return { ok: false, code: "rite-tree-differs", message: "the staged bundle derives another id" };
        if (state.returns <= 0) return { ok: false, code: "swarm-lei-spent", message: "the keep lei holds no return" };
        state.returns--;
        const tessera = String(++state.n).repeat(64).slice(0, 64);
        state.tesserae.push({ tessera, head: standing, landed: null });
        return { ok: true, output: { tessera, rite: "keep", lei: "d".repeat(64), n: state.n } };
      }
      if (verb === "keep-cut") {
        const target = join(ws, String(args["into"]));
        const staging = join(at, `cut-${state.n}`);
        const id = writeBundle(staging, state.notes);
        rmSync(staging, { recursive: true, force: true });
        let standing: unknown = null;
        try { standing = JSON.parse(readFileSync(join(target, MANIFEST_FILE), "utf8")).bundleId; } catch { standing = null; }
        if (standing === id) return { ok: true, output: { kept: false, standing: true, bundleId: id } };
        if (state.returns <= 0) return { ok: false, code: "swarm-lei-spent", message: "the keep lei holds no return" };
        state.returns--;
        writeBundle(target, state.notes);
        const tessera = String(++state.n).repeat(64).slice(0, 64);
        state.tesserae.push({ tessera, head: id, landed: null });
        return { ok: true, output: { kept: true, bundleId: id, tessera, lei: "d".repeat(64), n: state.n } };
      }
      if (verb === "receipts") {
        const red = state.tesserae.filter((t) => t.landed === null).map((t) => ({ tessera: t.tessera, rite: "keep", red: "landed-absent", branch: "backup", head: t.head }));
        return { ok: true, output: { conferre: { par: [], red } } };
      }
      const t = state.tesserae.find((x) => x.tessera === args["tessera"]);
      if (!t) return { ok: false, code: "rite-begun-absent", message: "none" };
      t.landed = String(args["head"]);
      return { ok: true, output: { tessera: t.tessera, par: t.head === t.landed } };
    },
  };
  const commits = (): number => Number(must(ws, "rev-list", "--count", "HEAD"));
  const remoteManifest = (): string => JSON.parse(must(remote, "show", "main:house/manifest.json")).bundleId;
  return { remote, ws, calls, said, state, ports, commits, remoteManifest, sessions, device };
}

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "lar-keep-host-"));
  gitConfig = join(scratch, "gitconfig");
  writeFileSync(gitConfig, "[user]\n\tname = Keeper\n\temail = keeper@example.invalid\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n");
});
afterEach(() => { rmSync(scratch, { recursive: true, force: true }); });

describe("the keep rite, host half", () => {
  test("KH1 RED: a workspace with changes outside <into> refuses before the vessel half runs, and nothing spends; CONTROL: changes inside <into> alone pass the guard", async () => {
    const r = rig();
    writeFileSync(join(r.ws, "notes.txt"), "the operator's own note\n");
    const out = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(out).toMatchObject({ code: 1, data: { refusal: "keep-tree-unclean", stopped: "guard", outside: ["notes.txt"] } });
    expect(r.calls).toEqual([]);
    rmSync(join(r.ws, "notes.txt"));
    mkdirSync(join(r.ws, "house"));
    writeFileSync(join(r.ws, "house", "stray"), "left by a keep that never pushed\n");
    expect((await riteKeepHost(r.ports, { workspace: "backup" })).code).toBe(0);
  });

  test("KH2 RED: a workspace where <into> reads `text` (no `* -text` guard) refuses before the vessel half runs", async () => {
    const r = rig({ guard: false });
    const out = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(out).toMatchObject({ code: 1, data: { refusal: "keep-text-guard-absent", stopped: "guard" } });
    expect(String(out.data["message"])).toMatch(/\* -text/);
    expect(r.calls).toEqual([]);
  });

  test("KH3 RED: a push that fails lands nothing and names the cure; run again with the remote mended, the rite pushes what waits and lands that very tessera", async () => {
    const r = rig();
    must(r.ws, "remote", "set-url", "origin", join(scratch, "nowhere.git"));
    const out = await riteKeepHost(r.ports, { workspace: "backup" });
    const { tessera, bundleId } = out.data as { tessera: string; bundleId: string };
    expect(out).toMatchObject({ code: 1, data: { kept: true, committed: true, stopped: "push", refusal: "keep-push-refused" } });
    expect(r.calls.some((c) => c.startsWith("land"))).toBe(false);
    expect(String(out.data["message"])).toContain(`tessera ${tessera} reads red (landed-absent)`);
    expect(String(out.data["message"])).toContain("lares rite keep --workspace backup");
    expect(String(out.data["message"])).toContain(`lares rite land --tessera ${tessera} --head ${bundleId}`);
    must(r.ws, "remote", "set-url", "origin", r.remote);
    const again = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(again).toMatchObject({ code: 0, data: { kept: false, committed: false, pushed: true, par: true, landed: [{ tessera, par: true }] } });
    expect(r.remoteManifest()).toBe(bundleId);
  });

  test("KH4 RED: the full walk commits `keep <id>`, pushes it, and lands the tessera at the id the pushed manifest names; par", async () => {
    const r = rig();
    const out = await riteKeepHost(r.ports, { workspace: "backup" });
    const { tessera, bundleId } = out.data as { tessera: string; bundleId: string };
    expect(out).toMatchObject({ code: 0, data: { kept: true, committed: true, pushed: true, par: true, landed: [{ tessera, par: true }] } });
    expect(must(r.remote, "log", "-1", "--format=%s", "main")).toBe(`keep ${bundleId}`);
    expect(r.remoteManifest()).toBe(bundleId);
    expect(r.calls.map((c) => c.split(" ")[0])).toEqual(["keep-cut", "land"]);
    expect(r.calls[1]).toBe(`land ${JSON.stringify({ tessera, head: bundleId })}`);
    expect(must(r.ws, "status", "--porcelain")).toBe("");
  });

  test("KH5 CONTROL: an unchanged second keep commits nothing, pushes nothing and lands nothing", async () => {
    const r = rig();
    expect((await riteKeepHost(r.ports, { workspace: "backup" })).code).toBe(0);
    const n = r.commits();
    r.calls.length = 0;
    const again = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(again).toMatchObject({ code: 0, data: { kept: false, committed: false, pushed: false, landed: [], par: true } });
    expect(r.commits()).toBe(n);
    expect(r.calls.map((c) => c.split(" ")[0])).toEqual(["keep-cut", "receipts"]);
  });

  test("KH6 RED: a bundle holding a secret-shaped string refuses and commits nothing; CONTROL: a PLANTED fixture and the AWS documentation key pass", async () => {
    expect(secretShapes("token ghp_PLANTEDaaaaaaaaaaaaaaaaaaaa and AKIAIOSFODNN7EXAMPLE")).toEqual([]);
    const r = rig();
    const n = r.commits();
    r.state.notes = { heron: `remember the heron\ntoken ${"ghp_"}${"x".repeat(30)}\n` };
    const out = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(out).toMatchObject({ code: 1, data: { refusal: "keep-secret-shaped", stopped: "guard" } });
    expect(String(out.data["message"])).toMatch(/heron\.tid \(ghp_xxxx…\)/);
    expect(r.commits()).toBe(n);
    expect(r.calls.some((c) => c.startsWith("land"))).toBe(false);
  });

  test("KH7: an upstream another clone moved rebases under the keep commit, and the push lands on top of it", async () => {
    const r = rig();
    const other = join(scratch, "other");
    must(scratch, "clone", "-q", r.remote, other);
    writeFileSync(join(other, "README"), "another device's note\n");
    must(other, "add", "README");
    must(other, "commit", "-q", "-m", "elsewhere");
    must(other, "push", "-q", "origin", "HEAD:refs/heads/main");
    const out = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(out).toMatchObject({ code: 0, data: { pushed: true, par: true } });
    expect(must(r.remote, "log", "--format=%s", "main").split("\n")).toEqual([`keep ${String(out.data["bundleId"])}`, "elsewhere", "guard"]);
    expect(existsSync(join(r.ws, "README"))).toBe(true);
  });

  test("KH17 RED: a keep commit carries the fixed neutral author and committer the code names, never the host's ambient git identity, and the rebase over a moved upstream keeps it; CONTROL: another clone's own commit keeps its own identity", async () => {
    const r = rig();
    const other = join(scratch, "other");
    must(scratch, "clone", "-q", r.remote, other);
    writeFileSync(join(other, "README"), "another device's note\n");
    must(other, "add", "README");
    must(other, "commit", "-q", "-m", "elsewhere");
    must(other, "push", "-q", "origin", "HEAD:refs/heads/main");
    const out = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(out).toMatchObject({ code: 0, data: { pushed: true, par: true } });
    const who = must(r.remote, "log", "--format=%an <%ae>|%cn <%ce>", "main").split("\n");
    expect(who[0], "the keep commit names the keep, never the operator").toBe("Lares Keep <keep@lares.invalid>|Lares Keep <keep@lares.invalid>");
    expect(who[1], "CONTROL: the other clone's commit carries the identity its own config names").toBe("Keeper <keeper@example.invalid>|Keeper <keeper@example.invalid>");
  });

  test("KH8 RED: beside the container house the host reads the workspace's directory from LARES_WORKSPACES; a name it never pairs, or a relative dir, refuses by name", () => {
    expect(workspaceFromPairs("backup", "notes=/srv/notes; backup=/srv/house-backup ;")).toBe("/srv/house-backup");
    for (const configured of ["", "notes=/srv/notes", "backup=relative/dir"]) {
      expect(() => workspaceFromPairs("backup", configured), configured).toThrow(KeepRefused);
    }
    try { workspaceFromPairs("backup", ""); } catch (e) { expect((e as KeepRefused).code).toBe("keep-workspace-unnamed-on-host"); }
  });

  test("KH9 keep-if-due-spends-nothing-on-an-unmoved-house: no fetch, no push, no landing; CONTROL: a moved house keeps", async () => {
    const r = rig();
    expect((await riteKeepHost(r.ports, { workspace: "backup" })).code).toBe(0);
    const n = r.commits();
    const argv: string[] = [];
    const watched: KeepHostPorts = { ...r.ports, git: async (dir, a) => { argv.push(a[0]!); return runGit(dir, a); } };
    r.calls.length = 0;
    const idle = await riteKeepHost(watched, { workspace: "backup", ifDue: true });
    expect(idle).toMatchObject({ code: 0, data: { kept: false, due: false } });
    expect(argv.filter((a) => ["fetch", "push", "ls-remote", "commit", "rebase"].includes(a))).toEqual([]);
    expect(r.calls.map((c) => c.split(" ")[0])).toEqual(["keep-cut", "receipts"]);
    expect(r.state.n).toBe(1);
    expect(r.commits()).toBe(n);
    expect(r.said.at(-1)).toMatch(/has not moved since bundle/);
    // CONTROL: the house moves, and the same line keeps, pushes and lands.
    r.state.notes = { heron: "remember the heron\n", pond: "the pond at dusk\n" };
    const moved = await riteKeepHost(watched, { workspace: "backup", ifDue: true });
    expect(moved.data, JSON.stringify(moved.data)).toMatchObject({ kept: true, due: true, pushed: true, par: true });
    expect(r.remoteManifest()).toBe(String(moved.data["bundleId"]));
    // The line: `--if-due` alone names no workspace (the CLI reads the configured one); a plain keep still needs one.
    expect(keepPlan(parseArgs(["rite", "keep", "--if-due"]))).toEqual({ acceptOmissions: false, ifDue: true });
    expect(keepPlan(parseArgs(["rite", "keep", "--if-due", "--workspace", "backup"]))).toEqual({ workspace: "backup", acceptOmissions: false, ifDue: true });
    expect(keepPlan(parseArgs(["rite", "keep", "--workspace", "backup", "--no-sessions"]))).toEqual({ workspace: "backup", acceptOmissions: false, sessions: false });
    expect(keepPlan(parseArgs(["rite", "keep", "--workspace", "backup", "--sessions"]))).toEqual({ workspace: "backup", acceptOmissions: false, sessions: true });
    expect(() => keepPlan(parseArgs(["rite", "keep"]))).toThrow();
  });

  test("KH10 RED: a moved house after a pushed keep keeps again; the bundle file the new cut changed reads inside <into>", async () => {
    const r = rig();
    expect((await riteKeepHost(r.ports, { workspace: "backup" })).code).toBe(0);
    r.state.notes = { heron: "remember the heron\n", pond: "the pond at dusk\n" };
    const moved = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(moved.data, JSON.stringify(moved.data)).toMatchObject({ kept: true, committed: true, pushed: true, par: true });
    expect(r.remoteManifest()).toBe(String(moved.data["bundleId"]));
  });

  test("KH11 RED: one commit carries house/ and devices/<name>-<id8>/, and one push carries it", async () => {
    const r = rig();
    const before = r.commits();
    const pushes: string[] = [];
    const watched: KeepHostPorts = { ...r.ports, git: async (dir, a) => { if (a[0] === "push") pushes.push(a.join(" ")); return runGit(dir, a); } };
    const out = await riteKeepHost(watched, { workspace: "backup" });
    expect(out.data, JSON.stringify(out.data)).toMatchObject({ kept: true, committed: true, pushed: true, par: true, sessions: { device: r.device, moved: true } });
    expect(r.commits()).toBe(before + 1);
    expect(pushes.length).toBe(1);
    const carried = must(r.remote, "show", "--name-only", "--format=", "main").split("\n");
    expect(carried).toContain("house/manifest.json");
    expect(carried).toContain(`${r.device}/DEVICE.json`);
    expect(carried).toContain(`${r.device}/config/CLAUDE.md`);
    expect(carried).toContain(`${r.device}/config/claude.json`);
    expect(carried).toContain(`${r.device}/projects/-home-me-proj/memory/MEMORY.md`);
    expect(carried).toContain(`${r.device}/projects/-home-me-proj/sessions/aaaa.jsonl.zst`);
    expect(carried.every((p) => p.startsWith("house/") || p.startsWith(`${r.device}/`)), carried.join(" ")).toBe(true);
    expect(must(r.remote, "show", `main:${r.device}/config/claude.json`)).not.toContain("u-123");
    expect(r.calls.map((c) => c.split(" ")[0])).toEqual(["keep-cut", "land"]);
    expect(r.state.returns).toBe(11);
    expect(must(r.ws, "status", "--porcelain")).toBe("");
  });

  test("KH12 RED: the guard allows exactly <into> and this device's dir; another device's dir, or this dir under another uuid, refuses before the vessel half runs", async () => {
    const r = rig();
    mkdirSync(join(r.ws, "devices", "another-00000000"), { recursive: true });
    writeFileSync(join(r.ws, "devices", "another-00000000", "note"), "another device's file\n");
    const out = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(out).toMatchObject({ code: 1, data: { refusal: "keep-tree-unclean", stopped: "guard", outside: ["devices/another-00000000/note"] } });
    expect(String(out.data["message"])).toContain(`outside house/ and ${r.device}/`);
    expect(r.calls).toEqual([]);
    rmSync(join(r.ws, "devices", "another-00000000"), { recursive: true });
    // This device's own dir, changed by a keep that never pushed, passes the guard; the same dir under another uuid refuses.
    mkdirSync(join(r.ws, r.device), { recursive: true });
    writeFileSync(join(r.ws, r.device, "DEVICE.json"), '{"uuid": "00000000-0000-5000-8000-000000000000", "name": "hale"}');
    const foreign = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(foreign).toMatchObject({ code: 1, data: { refusal: "keep-device-foreign", stopped: "guard" } });
    expect(r.calls).toEqual([]);
    expect(r.state.returns).toBe(12);
    rmSync(join(r.ws, r.device), { recursive: true });
    expect((await riteKeepHost(r.ports, { workspace: "backup" })).code).toBe(0);
  });

  test("KH13 RED: a secret-shaped file in the mirror stays out of the commit, in place and named with its cure; the clean device files commit and push, and a later keep does not refuse on it", async () => {
    const r = rig();
    const n = r.commits();
    r.sessions.put("projects/-home-me-proj/memory/token.md", `the token ${"ghp_"}${"y".repeat(30)}\n`);
    r.sessions.put("projects/-home-me-proj/bbbb.jsonl", `{"type":"user","text":"${"sk-ant-"}${"z".repeat(20)}"}\n`);
    const plain = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(plain.data, JSON.stringify(plain.data)).toMatchObject({ kept: true, committed: true, pushed: true, par: true });
    expect(plain.code).toBe(0);
    expect(r.commits()).toBe(n + 1);
    const line = r.said.filter((l) => /withheld from the commit/.test(l));
    expect(line).toHaveLength(1);
    expect(line[0]).toContain(`${r.device}/projects/-home-me-proj/memory/token.md (ghp_yyyy…)`);
    expect(line[0]).toContain(`${r.device}/projects/-home-me-proj/sessions/bbbb.jsonl.zst (sk-ant-z…)`);
    expect(line[0]).toContain(r.sessions.claude);
    const carried = must(r.remote, "show", "--name-only", "--format=", "main").split("\n");
    expect(carried).toContain(`${r.device}/config/CLAUDE.md`);
    expect(carried).not.toContain(`${r.device}/projects/-home-me-proj/memory/token.md`);
    expect(carried).not.toContain(`${r.device}/projects/-home-me-proj/sessions/bbbb.jsonl.zst`);
    // In place, untracked: the workspace holds them and no later keep refuses on them (with the sessions or without).
    expect(existsSync(join(r.ws, r.device, "projects/-home-me-proj/memory/token.md"))).toBe(true);
    expect(must(r.ws, "status", "--porcelain")).toContain("token.md");
    r.state.notes = { heron: "remember the heron\n", pond: "the pond at dusk\n" };
    const again = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(again.code, JSON.stringify(again.data)).toBe(0);
    const bare = await riteKeepHost(r.ports, { workspace: "backup", sessions: false });
    expect(bare.code, JSON.stringify(bare.data)).toBe(0);
    expect(must(r.remote, "ls-tree", "-r", "--name-only", "main")).not.toContain("token.md");
    // CLEARED at the source: the mirror follows (the workspace file stays until the hand removes it), and the keep carries no complaint.
    rmSync(join(r.sessions.claude, "projects/-home-me-proj/memory/token.md"));
    rmSync(join(r.ws, r.device, "projects/-home-me-proj/memory/token.md"));
    // CONTROL: the house's own planted fixtures pass, as they pass the script's scan.
    r.sessions.put("projects/-home-me-proj/cccc.jsonl", `{"type":"user","text":"${"ghp_"}PLANTED${"a".repeat(20)} and AKIAIOSFODNN7EXAMPLE"}\n`, 1800);
    const passed = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(passed.data, JSON.stringify(passed.data)).toMatchObject({ pushed: true, par: true });
    expect(must(r.remote, "ls-tree", "-r", "--name-only", "main")).toContain("cccc.jsonl.zst");
  });

  test("KH13b RED: a --no-sessions keep commits the device changes already standing in this device's dir (mirroring nothing), and still refuses changes outside house/ and this dir", async () => {
    const r = rig();
    expect((await riteKeepHost(r.ports, { workspace: "backup" })).code).toBe(0);
    // A refused earlier keep left mirror files standing; a later --no-sessions keep carries the clean ones, never the secret one.
    writeFileSync(join(r.ws, r.device, "config", "left-behind.md"), "mirrored once, never committed\n");
    writeFileSync(join(r.ws, r.device, "config", "secret.md"), `${"ghp_"}${"q".repeat(30)}\n`);
    r.state.notes = { heron: "remember the heron\n" };
    const out = await riteKeepHost(r.ports, { workspace: "backup", sessions: false });
    expect(out.code, JSON.stringify(out.data)).toBe(0);
    const tree = must(r.remote, "ls-tree", "-r", "--name-only", "main");
    expect(tree).toContain(`${r.device}/config/left-behind.md`);
    expect(tree).not.toContain("secret.md");
    expect(r.said.some((l) => /withheld from the commit/.test(l) && l.includes("secret.md"))).toBe(true);
    // Changes elsewhere outside house/ still refuse.
    writeFileSync(join(r.ws, "stray.txt"), "not the keep's\n");
    const calls = r.calls.length;
    const stray = await riteKeepHost(r.ports, { workspace: "backup", sessions: false });
    expect(stray).toMatchObject({ code: 1, data: { refusal: "keep-tree-unclean", outside: ["stray.txt"] } });
    expect(r.calls.length).toBe(calls);
  });

  test("KH17 a private-key header trips the guard only with key material after it: a header named in prose passes, a header with a base64 body refuses, in real lines, CRLF, escaped \\n and doubly escaped \\\\n", () => {
    const BEGIN = `${"-----"}BEGIN OPENSSH PRIVATE KEY-----`, END = `${"-----"}END OPENSSH PRIVATE KEY-----`;
    const lines = Array.from({ length: 5 }, (_, i) => `b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZWQyNTUxOQ${i}`);
    const header = `${"-----"}BEGIN OPENSSH PRIVATE KEY`;
    // PROSE: the header named in discussion, again and again, with no body after any mention, passes.
    const prose = Array.from({ length: 14 }, (_, i) => `{"type":"assistant","text":"turn ${i}: the guard reads \`${BEGIN}\` in a transcript\\nand no key follows it"}`).join("\n");
    expect(secretShapes(prose)).toEqual([]);
    expect(secretShapes(`the header ${BEGIN} then prose`)).toEqual([]);
    expect(secretShapes(`${BEGIN}\nMIIEvQ\n${END}`)).toEqual([]);
    expect(secretShapes(`${BEGIN}\n${"0123456789abcdef".repeat(2)}\nthe commit, not a key`)).toEqual([]);
    expect(secretShapes(`${BEGIN}\n${END}`)).toEqual([]);
    // MATERIAL: the header, then a base64 body of real length, refuses in every carriage a file meets.
    expect(secretShapes(`${BEGIN}\n${lines.join("\n")}\n${END}\n`)).toEqual([header]);
    expect(secretShapes(`${BEGIN}\r\n${lines.join("\r\n")}\r\n${END}\r\n`)).toEqual([header]);
    expect(secretShapes(`{"text":"${BEGIN}\\n${lines.join("\\n")}\\n${END}\\n"}`)).toEqual([header]);
    expect(secretShapes(`{"text":"{\\"text\\":\\"${BEGIN}\\\\n${lines.join("\\\\n")}\\\\n${END}\\"}"}`)).toEqual([header]);
    expect(secretShapes(`${BEGIN}${lines.join("")}${END}`)).toEqual([header]);
    expect(secretShapes(`  ${BEGIN}\n  ${lines.join("\n  ")}\n  ${END}`)).toEqual([header]);
    // A body with no END line inside the window still reads as material; so does an encrypted PEM with its header fields.
    expect(secretShapes(`${BEGIN}\n${lines.join("\n")}`)).toEqual([header]);
    const rsa = `${"-----"}BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,0123456789ABCDEF\n\n${lines.join("\n")}\n${"-----"}END RSA PRIVATE KEY-----`;
    expect(secretShapes(rsa)).toEqual([`${"-----"}BEGIN RSA PRIVATE KEY`]);
    // Prose that mentions the header and a key that stands later both read: the key alone counts.
    expect(secretShapes(`${prose}\n${BEGIN}\n${lines.join("\n")}\n${END}`)).toEqual([header]);
    // The other shapes read as before.
    expect(secretShapes(`token ${"ghp_"}${"x".repeat(30)}`)).toEqual([`${"ghp_"}${"x".repeat(30)}`]);
  });

  test("KH19 a body line reads whole: the operator's four mirror samples pass (a path, prose or a short token after an escaped newline is no key), as do short identifiers and hex digests after a header; real-shaped keys wrapped at 70 and 64 still refuse", () => {
    const BEGIN = `${"-----"}BEGIN OPENSSH PRIVATE KEY-----`, END = `${"-----"}END OPENSSH PRIVATE KEY-----`;
    const header = `${"-----"}BEGIN OPENSSH PRIVATE KEY`;
    // THE FOUR SAMPLES, verbatim as the session mirror held them (JSONL, escaped once or twice).
    for (const sample of MIRROR_SAMPLES) {
      expect(secretShapes(sample), sample).toEqual([]);
      expect(secretShapes(`{"type":"assistant","text":"${sample}"}`), sample).toEqual([]);
      expect(secretShapes(JSON.stringify({ text: sample })), sample).toEqual([]);
      expect(secretShapes(JSON.stringify({ text: JSON.stringify({ text: sample }) })), sample).toEqual([]);
    }
    expect(secretShapes(MIRROR_SAMPLES.join("\n"))).toEqual([]);
    // SHORT TOKENS after a header, each line base64-charactered yet no key line: identifiers, words, a field-shaped prose line.
    expect(secretShapes(`${BEGIN}\\npackages\\nsrc\\nriteKeepHost\\nsecretShapes\\nkeyBodyFollows\\nmirrorSessions\\nsessionSources\\nworkspaceFromPairs`)).toEqual([]);
    expect(secretShapes(`${BEGIN}\\nNote: the header\\nkeyBodyFollowsAgainAndAgainAndAgain\\nsecretShapesOverAndOverAndOver`)).toEqual([]);
    // HEX DIGESTS after a header (commit ids, sha256): long, base64-charactered, and no key.
    expect(secretShapes(`${BEGIN}\n${"e844e0d8b".padEnd(40, "0")}\n${"ab12".repeat(16)}\n${"cd34".repeat(16)}\n`)).toEqual([]);
    // REAL-SHAPED KEYS still refuse: an OpenSSH body wrapped at 70 with a short tail, a PEM body wrapped at 64, in every carriage.
    const b64 = Buffer.from(Array.from({ length: 400 }, (_, i) => (i * 37 + 11) & 255)).toString("base64");
    const wrap = (w: number): string[] => b64.match(new RegExp(`.{1,${w}}`, "g"))!;
    const ssh = wrap(70), pem = wrap(64);
    expect(ssh.at(-1)!.length).toBeLessThan(70);
    expect(secretShapes(`${BEGIN}\n${ssh.join("\n")}\n${END}\n`)).toEqual([header]);
    expect(secretShapes(`{"text":"${BEGIN}\\n${ssh.join("\\n")}\\n${END}\\n"}`)).toEqual([header]);
    expect(secretShapes(`{"text":"{\\"text\\":\\"${BEGIN}\\\\n${ssh.join("\\\\n")}\\\\n${END}\\"}"}`)).toEqual([header]);
    expect(secretShapes(`${"-----"}BEGIN PRIVATE KEY-----\r\n${pem.join("\r\n")}\r\n${"-----"}END PRIVATE KEY-----\r\n`)).toEqual([`${"-----"}BEGIN PRIVATE KEY`]);
    // Two full lines alone carry the minimum; one full line and a tail do too, while a lone short line never starts a run.
    expect(secretShapes(`${BEGIN}\n${ssh[0]}\n${ssh[1]}\n${END}`)).toEqual([header]);
    expect(secretShapes(`${BEGIN}\n${ssh[0]}\nAAAA\n${END}`)).toEqual([header]);
    expect(secretShapes(`${BEGIN}\nAAAA\n${ssh[0]}\n${END}`)).toEqual([]);
  });

  test("KH18 the session guard and the bundle guard each pass a header named in prose and refuse a planted header with its body", async () => {
    const BEGIN = `${"-----"}BEGIN OPENSSH PRIVATE KEY-----`, END = `${"-----"}END OPENSSH PRIVATE KEY-----`;
    const body = Array.from({ length: 5 }, (_, i) => `b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZWQyNTUxOQ${i}`);
    const prose = Array.from({ length: 14 }, (_, i) => `{"type":"assistant","text":"turn ${i}: \`${BEGIN}\` names a header\\nno key follows"}`).join("\n") + "\n";
    // SESSIONS, prose: the transcript discussing the header keeps.
    const r = rig();
    // The operator's four mirror samples ride the transcript and the record too: both guards keep them.
    const samples = MIRROR_SAMPLES.map((s) => `{"type":"user","text":"${s}"}`).join("\n") + "\n";
    r.sessions.put("projects/-home-me-proj/cccc.jsonl", prose + samples);
    r.state.notes = { heron: `the guard reads ${BEGIN} in discussion\nno key follows\n${MIRROR_SAMPLES.join("\n")}\n` };
    const kept = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(kept.data, JSON.stringify(kept.data)).toMatchObject({ committed: true, pushed: true, par: true });
    // SESSIONS, planted: a transcript carrying the header and its body, escaped inside JSONL, stays out of the commit and is named; the keep goes on.
    r.sessions.put("projects/-home-me-proj/dddd.jsonl", `{"type":"user","text":"${BEGIN}\\n${body.join("\\n")}\\n${END}\\n"}\n`, 1800);
    r.state.notes = { heron: "remember the heron\n", pond: "the pond at dusk\n" };
    r.said.length = 0;
    const planted = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(planted.code, JSON.stringify(planted.data)).toBe(0);
    expect(r.said.some((l) => l.includes(`${r.device}/projects/-home-me-proj/sessions/dddd.jsonl.zst (-----BEG…)`))).toBe(true);
    expect(must(r.remote, "ls-tree", "-r", "--name-only", "main")).not.toContain("dddd.jsonl.zst");
    // BUNDLE, planted: a record carrying the header and its body refuses at the bundle guard and commits nothing.
    const b = rig({ at: join(scratch, "bundle") });
    const m = b.commits();
    b.state.notes = { heron: `remember the heron\n${BEGIN}\n${body.join("\n")}\n${END}\n` };
    const bundled = await riteKeepHost(b.ports, { workspace: "backup", sessions: false });
    expect(bundled).toMatchObject({ code: 1, data: { refusal: "keep-secret-shaped", stopped: "guard" } });
    expect(String(bundled.data["message"])).toMatch(/heron\.tid \(-----BEG…\)/);
    expect(b.commits()).toBe(m);
  });

  test("KH14 RED: with the vessel down the keep names where the lei lives, exits non-zero, and commits and pushes nothing", async () => {
    const r = rig();
    const n = r.commits();
    const argv: string[] = [];
    const watched: KeepHostPorts = { ...r.ports, git: async (dir, a) => { argv.push(a[0]!); return runGit(dir, a); } };
    r.state.down = true;
    for (const ifDue of [false, true]) {
      const out = await riteKeepHost(watched, { workspace: "backup", ifDue });
      expect(out).toMatchObject({ code: 1, data: { refusal: "rite-row-unreached", stopped: "keep" } });
      expect(String(out.data["message"])).toContain("the keep lei lives in the vessel; up, then keep");
    }
    expect(argv.filter((a) => ["add", "commit", "fetch", "rebase", "push"].includes(a))).toEqual([]);
    expect(r.commits()).toBe(n);
    expect(must(r.ws, "diff", "--cached", "--name-only")).toBe("");
    expect(must(r.remote, "rev-list", "--count", "main")).toBe(String(n));
    // The vessel stands again: the keep that follows carries the house and the mirror that waited, in one commit.
    r.state.down = false;
    const up = await riteKeepHost(r.ports, { workspace: "backup" });
    expect(up.data, JSON.stringify(up.data)).toMatchObject({ kept: true, committed: true, pushed: true, par: true });
    expect(r.commits()).toBe(n + 1);
  });

  test("KH14b RED: a spent keep lei refuses first, before the mirror, the secret scan or the shore flush run, and names the cure; CONTROL: a standing lei lets the same keep through", async () => {
    const r = rig();
    const touched: string[] = [];
    const lei = (standing: boolean): KeepHostPorts["leiShow"] => async () => ({ ok: true, output: { lei: standing ? { standing: true } : { standing: false, refusal: "returns-spent", after: "a".repeat(64), returns: 12 } } });
    const watched = (standing: boolean): KeepHostPorts => ({
      ...r.ports, leiShow: lei(standing),
      sessions: { ...r.sessions.sources, unzstd: (f) => { touched.push("scan"); return r.sessions.sources.unzstd(f); } },
      flush: async () => { touched.push("flush"); return null; },
      row: async (verb, args) => { touched.push(`row:${verb}`); return r.ports.row(verb, args); },
    });
    const out = await riteKeepHost(watched(false), { workspace: "backup", face: 0 });
    expect(out).toMatchObject({ code: 1, data: { refusal: "swarm-lei-returns-spent" } });
    expect(String(out.data["message"])).toContain("`lares lei kui --rite keep --branch backup --returns 12 --face 0`");
    expect(touched).toEqual([]);
    expect(r.calls).toEqual([]);
    expect(existsSync(join(r.ws, r.device))).toBe(false);
    const unnamed = await riteKeepHost(watched(false), { workspace: "backup" });
    expect(unnamed).toMatchObject({ code: 1, data: { refusal: "swarm-lei-returns-spent" } });
    expect(touched).toEqual([]);
    const ok = await riteKeepHost(watched(true), { workspace: "backup" });
    expect(ok.code).toBe(0);
    expect(touched).toContain("flush");
  });

  test("KH15 RED: moved sessions over an unmoved house spend a return of their own before anything commits; with none left, nothing commits or pushes", async () => {
    const r = rig();
    expect((await riteKeepHost(r.ports, { workspace: "backup" })).code).toBe(0);
    expect(r.state.returns).toBe(11);
    const n = r.commits();
    r.calls.length = 0;
    r.sessions.put("projects/-home-me-proj/memory/heron.md", "the heron came back\n");
    const out = await riteKeepHost(r.ports, { workspace: "backup" });
    const bundleId = String(out.data["bundleId"]);
    expect(out.data, JSON.stringify(out.data)).toMatchObject({ kept: false, committed: true, pushed: true, par: true, sessions: { moved: true, spent: true } });
    expect(r.calls.map((c) => c.split(" ")[0])).toEqual(["keep-cut", "receipts", "begin", "receipts", "land"]);
    expect(r.calls[2]).toBe(`begin ${JSON.stringify({ rite: "keep", branch: "backup", head: bundleId, staging: "house" })}`);
    expect(r.state.returns).toBe(10);
    expect(r.commits()).toBe(n + 1);
    expect(must(r.remote, "show", "--name-only", "--format=", "main").split("\n")).toEqual([`${r.device}/projects/-home-me-proj/memory/heron.md`]);
    expect(r.state.tesserae.every((t) => t.landed === bundleId)).toBe(true);
    // No return left: the mirror rests in the workspace, and nothing commits or pushes.
    r.state.returns = 0;
    r.sessions.put("projects/-home-me-proj/memory/pond.md", "the pond at dusk\n");
    const argv: string[] = [];
    const watched: KeepHostPorts = { ...r.ports, git: async (dir, a) => { argv.push(a[0]!); return runGit(dir, a); } };
    const dry = await riteKeepHost(watched, { workspace: "backup" });
    expect(dry).toMatchObject({ code: 1, data: { refusal: "swarm-lei-spent", stopped: "sessions" } });
    expect(String(dry.data["message"])).toMatch(/no return spent/);
    expect(argv.filter((a) => ["add", "commit", "fetch", "rebase", "push"].includes(a))).toEqual([]);
    expect(r.commits()).toBe(n + 1);
    // A RETURN ALREADY SPENT CARRIES THE SESSIONS: a keep that cut and never pushed left its tessera owed at this bundle, and
    // the sessions that moved since ride that return; no second one spends.
    {
      const o = rig({ at: join(scratch, "second") });
      o.state.returns = 1;
      must(o.ws, "remote", "set-url", "origin", join(scratch, "nowhere.git"));
      expect(await riteKeepHost(o.ports, { workspace: "backup" })).toMatchObject({ code: 1, data: { refusal: "keep-push-refused", committed: true } });
      expect(o.state.returns).toBe(0);
      must(o.ws, "remote", "set-url", "origin", o.remote);
      o.sessions.put("projects/-home-me-proj/memory/kite.md", "fly the kite low\n");
      o.calls.length = 0;
      const rode = await riteKeepHost(o.ports, { workspace: "backup" });
      expect(rode.data, JSON.stringify(rode.data)).toMatchObject({ kept: false, committed: true, pushed: true, par: true, sessions: { moved: true, spent: false } });
      expect(o.calls.map((c) => c.split(" ")[0])).toEqual(["keep-cut", "receipts", "receipts", "land"]);
      expect(must(o.remote, "show", `main:${o.device}/projects/-home-me-proj/memory/kite.md`)).toBe("fly the kite low");
    }
    // `--if-due`: moved sessions read due; a lei strung again, the keep that waited commits and pushes.
    r.state.returns = 3;
    r.calls.length = 0;
    const due = await riteKeepHost(r.ports, { workspace: "backup", ifDue: true });
    expect(due.data, JSON.stringify(due.data)).toMatchObject({ kept: false, due: true, committed: true, pushed: true, par: true });
    expect(r.state.returns).toBe(2);
    // An unmoved house and unmoved sessions: `--if-due` spends nothing.
    r.calls.length = 0;
    const idle = await riteKeepHost(r.ports, { workspace: "backup", ifDue: true });
    expect(idle).toMatchObject({ code: 0, data: { kept: false, due: false } });
    expect(r.calls.map((c) => c.split(" ")[0])).toEqual(["keep-cut", "receipts"]);
    expect(r.state.returns).toBe(2);
  });

  test("KH16: `sessions: false` keeps the house alone; the switch reads the line's flag first, then LARES_KEEP_SESSIONS, and stands on where neither speaks", async () => {
    const r = rig();
    const out = await riteKeepHost(r.ports, { workspace: "backup", sessions: false });
    expect(out.data, JSON.stringify(out.data)).toMatchObject({ kept: true, committed: true, pushed: true, par: true });
    expect(out.data["sessions"]).toBeUndefined();
    expect(existsSync(join(r.ws, "devices"))).toBe(false);
    expect((await riteKeepHost({ ...r.ports, sessions: null }, { workspace: "backup" })).data["sessions"]).toBeUndefined();
    expect(keepSessionsOn(undefined, {}, null)).toBe(true);
    expect(keepSessionsOn(undefined, { LARES_KEEP_SESSIONS: "0" }, null)).toBe(false);
    expect(keepSessionsOn(undefined, {}, "LARES_KEEP_SESSIONS=off\n")).toBe(false);
    expect(keepSessionsOn(undefined, { LARES_KEEP_SESSIONS: "1" }, "LARES_KEEP_SESSIONS=off\n")).toBe(true);
    expect(keepSessionsOn(true, { LARES_KEEP_SESSIONS: "0" }, null)).toBe(true);
    expect(keepSessionsOn(false, {}, null)).toBe(false);
  });

  test("KH17 keep-acts-as-the-keep-face: with no face named, the host half carries the face the vessel half acted as into every row after the cut, and names it", async () => {
    const r = rig();
    const row = r.ports.row;
    const ports: KeepHostPorts = { ...r.ports, sessions: null, row: async (verb, args) => {
      const a = await row(verb, args);
      return verb === "keep-cut" && a.ok ? { ok: true, output: { ...a.output, face: 0, faceBy: "keep" } } : a;
    } };
    const out = await riteKeepHost(ports, { workspace: "backup" });
    expect(out).toMatchObject({ code: 0, data: { face: 0, faceBy: "keep", par: true } });
    expect(r.calls[0]).toBe(`keep-cut ${JSON.stringify({ workspace: "backup", into: "house" })}`);
    expect(r.calls.slice(1).length).toBeGreaterThan(0);
    for (const c of r.calls.slice(1)) expect(c).toContain('"face":0');
    expect(r.said.some((l) => /acting as h0, the keep's face/.test(l))).toBe(true);
    // A named face rides the cut as named.
    const n = rig({ at: join(scratch, "named") });
    const named = await riteKeepHost({ ...n.ports, sessions: null }, { workspace: "backup", face: 2 });
    expect(n.calls[0]).toBe(`keep-cut ${JSON.stringify({ workspace: "backup", into: "house", face: 2 })}`);
    expect(named.data).toMatchObject({ face: 2, faceBy: "named" });
  });

  test("KH19 spent-lei-offers-its-refill: a keep stopped on a spent lei strings the refill the refusal names (its returns, its face) through the refill port and goes on once; declined or on a pipe it keeps today's refusal", async () => {
    const spentRow = (r: ReturnType<typeof rig>, strung: { n: number }): KeepHostPorts["row"] => async (verb, args) => {
      if (verb === "keep-cut" && strung.n === 0) { r.calls.push(`${verb} ${JSON.stringify(args)}`); return { ok: false, code: "swarm-lei-returns-spent", message: "no keep lei stands for the workspace \"backup\" (returns-spent); the hand strings one: `lares lei kui --rite keep --branch backup --returns 6 --face 0`" }; }
      return r.ports.row(verb, args);
    };
    const r = rig(); const strung = { n: 0 }; const asked: unknown[] = [];
    const yes = await riteKeepHost({ ...r.ports, sessions: null, row: spentRow(r, strung), refill: async (req) => { asked.push(req); strung.n++; return { strung: true, remedy: "unused" }; } }, { workspace: "backup" });
    expect(asked).toEqual([{ rite: "keep", branch: "backup", returns: 6, face: 0 }]);
    expect(yes.code).toBe(0);
    expect(r.calls.filter((c) => c.startsWith("keep-cut"))).toHaveLength(2);
    const n = rig({ at: join(scratch, "declined") }); const none = { n: 0 };
    const no = await riteKeepHost({ ...n.ports, sessions: null, row: spentRow(n, none), refill: async () => ({ strung: false, remedy: "lares lei kui --rite keep --branch backup --returns 6 --face 0" }) }, { workspace: "backup" });
    expect(no).toMatchObject({ code: 1, data: { refusal: "swarm-lei-returns-spent" } });
    expect(n.calls.filter((c) => c.startsWith("keep-cut"))).toHaveLength(1);
  });

  test("KH18 keep-names-its-code-once: a vessel half refused under a message that already leads with its code says the code once", async () => {
    const r = rig();
    const ports: KeepHostPorts = { ...r.ports, sessions: null, row: async (verb, args) => {
      if (verb === "keep-cut") { r.calls.push(`${verb} ${JSON.stringify(args)}`); return { ok: false, code: "vessel-locked", message: "vessel-locked: run `lares vault unlock`, then run again" }; }
      return r.ports.row(verb, args);
    } };
    const out = await riteKeepHost(ports, { workspace: "backup" });
    expect(out).toMatchObject({ code: 1, data: { refusal: "vessel-locked" } });
    const line = r.said.find((l) => l.startsWith("keep: vessel-locked"));
    expect(line).toBe("keep: vessel-locked: run `lares vault unlock`, then run again");
    expect(String((out.data as { message?: unknown }).message)).not.toMatch(/vessel-locked: vessel-locked/);
  });
});

describe("the keep rite flushes every shore before the cut", () => {
  const reading = (over: Partial<ShoreFlushReading> = {}): ShoreFlushReading => ({
    islands: [
      { island: "daemon", answered: true, written: [{ uri: "lar:///a.b.c/one" }], writtenCount: 1, unwritten: [], unwrittenCount: 0, fileWrites: 1, drained: true },
      { island: "wiki:home", answered: true, written: [], writtenCount: 0, unwritten: [], unwrittenCount: 0, fileWrites: 0, drained: true },
      { island: "wiki:notes", answered: true, written: [{ uri: "lar:///a.b.c/two" }], writtenCount: 1, unwritten: [], unwrittenCount: 0, fileWrites: 1, drained: true },
    ],
    whole: true, ...over,
  });

  test("KF1 RED: the keep asks `lares shore flush` before the vessel cuts and says what every island wrote, a resident wiki beyond the active one among them; no reach gap rides the lines", async () => {
    const r = rig();
    const order: string[] = [];
    const row = r.ports.row;
    const out = await riteKeepHost({ ...r.ports, flush: async () => { order.push("flush"); return reading(); }, row: async (verb, args) => { order.push(verb); return row(verb, args); } }, { workspace: "backup" });
    expect(out.code).toBe(0);
    expect(order.slice(0, 2)).toEqual(["flush", "keep-cut"]);
    const said = r.said.join("\n");
    expect(said).toMatch(/keep: the shore's flush: daemon wrote 1 owed carrier\(s\)/);
    expect(said).toMatch(/keep: the shore's flush: wiki:notes wrote 1 owed carrier\(s\)/);
    expect(said).not.toMatch(/outside this door's reach|active wiki alone/);
    expect(out.data["shore"]).toMatchObject({ whole: true });
  });

  test("KF2 RED: a flush that leaves carriers unwritten, or answers nothing, names that and the keep goes on as it would", async () => {
    const r = rig();
    const strands = reading({ whole: false, islands: [{ island: "wiki", answered: true, written: [], writtenCount: 0, unwritten: [{ state: "failed", uri: "lar:///a.b.c/stuck", why: "its reconcile threw" }], unwrittenCount: 1, fileWrites: 0, drained: true }, { island: "daemon", answered: false, refusal: "unanswered", why: "timed out" }] });
    const out = await riteKeepHost({ ...r.ports, flush: async () => strands }, { workspace: "backup" });
    expect(out.code).toBe(0);
    const said = r.said.join("\n");
    expect(said).toMatch(/keep: the shore's flush: wiki wrote 0 owed carrier\(s\); 1 left unwritten: failed lar:\/\/\/a\.b\.c\/stuck \(its reconcile threw\)/);
    expect(said).toMatch(/keep: the shore's flush: daemon did not answer: unanswered: timed out/);
    expect(said).toMatch(/the bundle cuts from the records, and those mirrors stay behind/);
    const r2 = rig({ at: join(scratch, "second") });
    const quiet = await riteKeepHost({ ...r2.ports, flush: async () => null }, { workspace: "backup" });
    expect(quiet.code).toBe(0);
    expect(r2.said.join("\n")).toMatch(/keep: the shore's flush answered nothing \(`lares shore flush` reads it\); the keep goes on/);
  });
});
