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
 *   KH7  an upstream another clone moved rebases under the keep commit, and the push lands on top of it.
 *
 * Real git over scratch repos; the vessel's rows answer from a recorded fake.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CARRY_SCHEMA, MANIFEST_FILE, bundleIdOf, sha256Hex, zeroCounts, type CarryFile } from "../src/carry-manifest.js";
import { riteKeepHost, secretShapes, type GitAnswer, type KeepHostPorts } from "../src/rite-keep-host.js";

let scratch: string, gitConfig: string;

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
  const files: CarryFile[] = [];
  for (const [name, text] of Object.entries(notes)) {
    const rel = `faces/f0/working/${name}.tid`, abs = join(dest, ...rel.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    files.push({ path: rel, sha256: sha256Hex(text), bytes: Buffer.byteLength(text) });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  const bundleId = bundleIdOf(files);
  writeFileSync(join(dest, MANIFEST_FILE), `${JSON.stringify({ schema: CARRY_SCHEMA, bundleId, faces: [{ key: "f0", petname: "steward" }], files, rows: [], counts: zeroCounts(), tempBytes: {}, omissions: [] }, null, 2)}\n`);
  return bundleId;
}

/** The scratch remote, the workspace clone of it (guarded with `* -text` unless told not to), and the vessel's rows. */
function rig(over: { guard?: boolean } = {}) {
  const remote = join(scratch, "remote.git"), ws = join(scratch, "workspace");
  mkdirSync(remote);
  must(remote, "init", "-q", "--bare");
  must(scratch, "clone", "-q", remote, ws);
  if (over.guard !== false) {
    writeFileSync(join(ws, ".gitattributes"), "* -text\n");
    must(ws, "add", ".gitattributes");
    must(ws, "commit", "-q", "-m", "guard");
    must(ws, "push", "-q", "origin", "HEAD:refs/heads/main");
  }
  const calls: string[] = [], said: string[] = [];
  const state = { notes: { heron: "remember the heron\n" } as Record<string, string>, n: 0, tesserae: [] as { tessera: string; head: string; landed: string | null }[] };
  const ports: KeepHostPorts = {
    workspaceDir: (name) => { expect(name).toBe("backup"); return ws; },
    git: async (dir, argv) => runGit(dir, argv),
    say: (line) => { said.push(line); },
    row: async (verb, args) => {
      calls.push(`${verb} ${JSON.stringify(args)}`);
      if (verb === "keep-cut") {
        const target = join(ws, String(args["into"]));
        const staging = join(scratch, `cut-${state.n}`);
        const id = writeBundle(staging, state.notes);
        rmSync(staging, { recursive: true, force: true });
        let standing: unknown = null;
        try { standing = JSON.parse(readFileSync(join(target, MANIFEST_FILE), "utf8")).bundleId; } catch { standing = null; }
        if (standing === id) return { ok: true, output: { kept: false, standing: true, bundleId: id } };
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
  return { remote, ws, calls, said, state, ports, commits, remoteManifest };
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
});
