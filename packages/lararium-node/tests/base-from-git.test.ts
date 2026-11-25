/**
 * BASE FROM GIT (face-pools A5) — after a re-found the synced tree names no base, and the pool's HEAD stands in for one.
 *
 * The synced tree rests in `hearth/checkpoints/projection`, which a re-found clears; a face pool under
 * `projections/faces/<pet name>/` outlives it with its git history. Read with no base, every edited file meets a `no-base`
 * stand-off. Read with the pool's HEAD as the base, each state resolves:
 *
 *   G1 disk equals HEAD, records equal HEAD    → the base pins (both legs)
 *   G2 records moved, disk equals HEAD         → the records project
 *   G3 records equal HEAD, disk moved          → the disk ingests
 *   G4 both moved                              → a `both-moved` stand-off over HEAD (never `no-base`); HEAD's blob holds the
 *                                                base the key folded, so `lares shore take-disk` merges over it
 *   G5 a file whose record the house does not hold → no base pins from HEAD: the projector pins nothing, and the wave lands
 *                                                the file (records absent) rather than echoing HEAD into a pinned base
 *   G6 a file outside any pool, or a pool with no `.git`, reads no HEAD and spawns no git
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { carrierHash } from "@lararium/mesh/crypto";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";
import { syncedTreeKey } from "../src/synced-tree.js";
import { candidatesOf, fileToUriForSource, listSourceFiles, scanFiles, settleIngest } from "../src/ingest-scan.js";
import { poolHeadOf, poolHeads } from "../src/pool-head.js";
import type { GitRun } from "../src/watch-core.js";

const DISK_EDIT = "A HAND WROTE THIS LINE IN THE POOL.";
const RECORDS_EDIT = "THE RECORDS TOOK THIS LINE IN THE WIKI.";
const addLine = (text: string, line: string): string => text.replace(/\n! ([^\n]*)\n/, (m) => `${m}\n${line}\n`);

/** Git in the pool, walled: no caller `GIT_*`, an empty global config, no system config. */
function git(cwd: string, ...args: string[]): string {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("GIT_")) env[k] = v;
  env["GIT_CONFIG_GLOBAL"] = "/dev/null";
  env["GIT_CONFIG_NOSYSTEM"] = "1";
  const r = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

describe.skipIf(coreBlobSkip)("after a re-found, the pool's HEAD stands in for the cleared base", () => {
  let rig: ShoreRig;
  let A: string, B: string, C: string, D: string;
  const E = "lar:///ha.ka.ba/lares/api/pono/a-carrier-the-house-never-held";
  const wikiSays = (uri: string, words: string): boolean =>
    rig.titlesOf(uri).some((t) => String((rig.engine.$tw as unknown as { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } } }).wiki.getTiddler(t).fields["text"] ?? "").includes(words));

  /** One unattended wave over the whole pool, as the watch core's settle sends it, reading HEAD where no base stands. */
  async function poolWave() {
    const scan = scanFiles(rig.scratch, listSourceFiles(rig.bagDir)!, RIG_BAG, rig.tree, fileToUriForSource(rig.scratch, rig.bagDir), poolHeads(rig.bagDir));
    const settled = await settleIngest({ source: rig.bagDir, toBag: RIG_BAG, candidates: candidatesOf(scan.rows), did: "did:test", unattended: true }, rig.tree, rig.submitWave);
    await rig.land();
    return { scan, settled };
  }

  beforeAll(async () => {
    rig = await ShoreRig.stand(4);
    [A, B, C, D] = rig.uris as [string, string, string, string];
    await rig.ingest();
    await rig.boot();
    await rig.rest();
    // A file the house never took: its record stands nowhere, though the pool's history holds it.
    rig.write(E, rig.read(C).replaceAll(C.slice("lar:///".length), E.slice("lar:///".length)));
    // The pool's history: every file as the last sitting left it.
    git(rig.bagDir, "init", "-q");
    git(rig.bagDir, "add", "-A");
    git(rig.bagDir, "-c", "user.name=Heron", "-c", "user.email=heron@face.invalid", "commit", "-q", "-m", "lar:///pool.closes.the-sitting/lock — the sitting closes");
    // While the vessel rests: the records move under B and D, a hand moves the files of C and D.
    for (const uri of [B, D]) {
      const slot = rig.titlesOf(uri).find((t) => t.includes("#/")) ?? uri;
      const held = (rig.engine.$tw as unknown as { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } } }).wiki.getTiddler(slot)!;
      const text = `${String(held.fields["text"] ?? "")}\n\n${RECORDS_EDIT}`;
      // The wiki the projector renders, and the bag the island's gate weighs, both take the edit.
      await rig.save(slot, text);
      const { "$origin-bag": _bag, ...fields } = held.fields;
      await rig.store.put({ tiddler: { ...fields, text } }, { kind: "operator-import", sessionId: "base-from-git" });
    }
    for (const uri of [C, D]) rig.write(uri, addLine(rig.read(uri), DISK_EDIT));
    // THE RE-FOUND: the synced tree comes back empty.
    rig.newTree();
  }, 300_000);
  afterAll(async () => { await rig?.close(); });

  test("the projecting leg: G1 pins, G2 projects, G3 stands down for the ingest leg, G4 stands off both-moved, G5 pins nothing", async () => {
    await rig.boot({ extra: { baseFromGit: poolHeads(rig.bagDir) } });
    // G4 alone stands off, and over HEAD: both moved, never `no-base`.
    expect(rig.conflicts.map((c) => c.uri)).toEqual([D]);
    expect(rig.conflicts[0]!.reason).toMatch(/both moved/);
    expect(rig.conflicts[0]!.reason).not.toMatch(/no-base/);
    // The base the standoff folded is HEAD's blob, which the shore's merge reads back by its hash.
    const stood = rig.projector.standing().find((s) => s.uri === D)!;
    const head = poolHeadOf(rig.fileOf(D))!;
    expect(stood.base?.disk).toBe(carrierHash(head.body));
    expect(head.body).not.toContain(DISK_EDIT);
    // G1: the untouched carrier pins its base.
    expect(rig.tree.base(syncedTreeKey(RIG_BAG, A))).not.toBeNull();
    // G2: the records' edit reached the file.
    expect(rig.read(B)).toContain(RECORDS_EDIT);
    // G3: the hand's edit stays on disk, and no base pins over it.
    expect(rig.read(C)).toContain(DISK_EDIT);
    expect(rig.tree.base(syncedTreeKey(RIG_BAG, C))).toBeNull();
    // G5: no record, no base.
    expect(rig.tree.base(syncedTreeKey(RIG_BAG, E))).toBeNull();
    await rig.rest();
  });

  test("the ingest leg after a second re-found: G1 pins from HEAD, G3 ingests, G4 stands off both-moved, G5 lands rather than pins", async () => {
    rig.newTree();
    const { scan, settled } = await poolWave();
    const row = (uri: string) => scan.rows.find((r) => r.uri === uri)!;
    // Each row the pool holds rides with HEAD's base and says so.
    expect(row(A).syncedHash).toBe(carrierHash(poolHeadOf(rig.fileOf(A))!.body));
    expect((row(A) as { headBase?: boolean }).headBase).toBe(true);
    // G1: the disk equals HEAD and the records match it: an echo, and the base pins at HEAD's two sides.
    expect(settled.named.get(A)?.["decision"]).toBe("noop");
    const pinned = rig.tree.base(syncedTreeKey(RIG_BAG, A));
    expect(pinned?.disk).toBe(row(A).diskHash);
    expect(pinned?.records).toBe(row(A).syncedRecordsHash ?? row(A).syncedHash);
    // G3: the records stand at HEAD and the disk moved: the hand's words land.
    expect(settled.named.get(C)?.["decision"]).toBe("ingest");
    expect(wikiSays(C, DISK_EDIT)).toBe(true);
    // G4: both moved past HEAD: a stand-off, never `no-base`, and nothing lands.
    expect(settled.conflicts.map((c) => c.uri)).toEqual([D]);
    expect(settled.named.get(D)?.["reason"]).toBe("both-moved");
    expect(wikiSays(D, DISK_EDIT)).toBe(false);
    // G5: the house holds no record under E, so HEAD names no base for it: the file lands as an arrival, never as an echo.
    expect(settled.named.get(E)?.["decision"]).toBe("ingest");
    expect(rig.titlesOf(E).length).toBeGreaterThan(0);
  });
});

describe("G6 — no pool, no HEAD", () => {
  let scratch: string;
  beforeAll(() => { scratch = mkdtempSync(path.join(tmpdir(), "lar-base-from-git-")); });
  afterAll(() => { rmSync(scratch, { recursive: true, force: true }); });

  test("a pool with no .git, and a file outside the pool, read no HEAD and spawn no git", () => {
    const pool = path.join(scratch, "faces", "Heron");
    const file = path.join(pool, "wiki", "Room 4.tid");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "title: Room 4\n\nwords\n");
    const runs: string[][] = [];
    const spy: GitRun = (args) => { runs.push([...args]); return { code: 1, stdout: "", stderr: "" }; };
    expect(poolHeads(pool, spy)(file)).toBeNull();
    mkdirSync(path.join(pool, ".git"));
    expect(poolHeads(pool, spy)(path.join(scratch, "elsewhere.tid"))).toBeNull();
    expect(runs).toEqual([]);
  });

  test("a file HEAD never held reads no HEAD", () => {
    const pool = path.join(scratch, "faces", "Egret");
    mkdirSync(path.join(pool, "wiki"), { recursive: true });
    writeFileSync(path.join(pool, "wiki", "kept.tid"), "title: kept\n\nwords\n");
    git(pool, "init", "-q");
    git(pool, "add", "-A");
    git(pool, "-c", "user.name=Egret", "-c", "user.email=egret@face.invalid", "commit", "-q", "-m", "lar:///pool.closes.the-sitting/lock — x");
    const fresh = path.join(pool, "wiki", "fresh.tid");
    writeFileSync(fresh, "title: fresh\n\nwords\n");
    expect(poolHeads(pool)(fresh)).toBeNull();
    expect(poolHeads(pool)(path.join(pool, "wiki", "kept.tid"))?.body).toBe("title: kept\n\nwords\n");
  });
});
