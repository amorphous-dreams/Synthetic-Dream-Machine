/**
 * TAKE-DISK MERGES BY SLOT AGAINST THE LAST AGREEMENT.
 *
 * A standoff stands where the file and the records both moved past their last agreement. `shore take-disk` once
 * landed the WHOLE file, so a records-side edit to one slot vanished when the disk side edited another (the
 * tideline rehearsal, research/tideline-surface #/rehearsal). The door now merges the three sides through the one
 * seal merge (`@lararium/mesh/meme-merge`): the base's words, the records' render the island weighed under the key,
 * and the file as the hand left it. A clean merge re-seals, writes the file and lands through the ingest leg; two
 * edits to one slot refuse by name, and nothing writes or lands on either side.
 *
 * THE BASE'S WORDS COME FROM A PLACE THAT HOLDS THEM IN CLEAR BY LAW (sealed-store R1): the face pool's own git
 * history, the blob at the newest commit whose bytes hash to the base the key folded. No store beside the synced
 * tree keeps text. A file in no pool, or a pool with no commit holding the base, lands whole and says why.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carrierHash, VERB_RESULT_KEY } from "@lararium/mesh";
import { stampCarrier } from "@lararium/memetic-frame";
import { SyncedTree, syncedTreeKey } from "@lararium/node";
import { takeDisk, type TakeDiskDeps } from "../src/shore-take-disk.js";
import type { ShoreAnswer } from "../src/shore-core.js";
import type { SubmitIngestOpts } from "../src/ingest-core.js";
import type { SubmitResult } from "../src/verb-result.js";

const BAG = "lar:///ha.ka.ba/bags/x";
const URI = "lar:///ha.ka.ba/x/merge-note";
const KEY = "b".repeat(24);
let tmp = "";
afterEach(() => { if (tmp) { rmSync(tmp, { recursive: true, force: true }); tmp = ""; } });

const slot = (name: string, line: string): string[] => [`<<~ ahu slot=\`#/${name}\`>>`, "", line, "", "<<~/ahu>>", ""];
/** A sealed carrier holding slots #/a and #/b. */
const carrier = (a: string, b: string): string => stampCarrier([
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>",
  "",
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>`,
  "<<^ code=`&#x0002;`>>",
  "",
  "```toml meta",
  `title = "${URI}"`,
  "type  = \"text/memetic-wikitext+tiddlywiki\"",
  "```",
  "",
  ...slot("a", a),
  ...slot("b", b),
  "<<^ code=`&#x0003;`>>",
  "",
  "<<^ code=`&#x0004;` to=`?`>>",
  "",
].join("\n"));

const BASE = carrier("a holds.", "b holds.");

/** One git run in the scratch pool, with no ambient git identity or hook env. */
function git(cwd: string, ...args: string[]): void {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const r = spawnSync("git", ["-c", "user.name=pet", "-c", "user.email=pet@face.invalid", "-c", "commit.gpgsign=false", ...args], { cwd, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

/**
 * A scratch face pool (`faces/<pet name>/`) whose mirror file holds `disk`, a synced base row at it naming `base` by hash
 * alone, and an island that weighed `records`. `pool: "commits"` founds the pool's git and commits `base` (then
 * `later` commits, where named); `"none"` leaves the pool with no history.
 */
function rig(disk: string, records: string, base: string | null, pool: { history: "commits" | "none"; later?: readonly string[] } = { history: "commits" }): { path: string; waves: SubmitIngestOpts[]; deps: TakeDiskDeps } {
  tmp = mkdtempSync(join(tmpdir(), "take-disk-merge-"));
  const face = join(tmp, "projections", "faces", "pet");
  const dir = join(face, "wiki", "ha.ka.ba", "x");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "merge-note.mem");
  if (pool.history === "commits" && base !== null) {
    git(face, "init", "-q");
    for (const words of [base, ...(pool.later ?? [])]) {
      writeFileSync(path, words);
      git(face, "add", "-A");
      git(face, "commit", "-q", "-m", "lar:///pool.closes.the-sitting/lock — the sitting closes");
    }
  }
  writeFileSync(path, disk);
  const tree = new SyncedTree(join(tmp, "synced"));
  if (base !== null) tree.set(syncedTreeKey(BAG, URI), path, carrierHash(base), carrierHash(base));
  const row = {
    bagId: BAG, uri: URI, standoff: KEY, kind: "sides", reason: "both-moved", path,
    disk: carrierHash(disk), records: carrierHash(records),
    ...(base !== null ? { base: { disk: carrierHash(base), records: carrierHash(base) } } : {}),
  };
  const ask = async (a: Readonly<Record<string, unknown>>): Promise<ShoreAnswer> => {
    if (a["op"] === "render") {
      return a["key"] === KEY
        ? { ok: true, refusal: null, why: null, output: { ok: true, op: "render", bag: BAG, uri: URI, key: KEY, records: carrierHash(records), text: records } }
        : { ok: false, refusal: "standoff-key-moved", why: "another key", output: {} };
    }
    return { ok: true, refusal: null, why: null, output: { ok: true, standoffs: [row], standoffCount: 1, pending: [], pendingCount: 0, mark: "one-shore", next: null } };
  };
  const waves: SubmitIngestOpts[] = [];
  const submit = async (o: SubmitIngestOpts): Promise<SubmitResult> => {
    waves.push(o);
    return {
      status: "done", requestId: "req-merge",
      results: { [VERB_RESULT_KEY]: { ok: true, output: { carriers: o.candidates.map((c) => ({ uri: c.uri, decision: "ingest", grade: "clean", landed: 1 })) } } },
    } as SubmitResult;
  };
  return { path, waves, deps: { ask, tree, root: tmp, did: "did:test", submit } };
}

describe("lares shore take-disk — the records' slot edit survives the disk's", () => {
  test("★ a records edit to #/a and a disk edit to #/b both stand after take-disk ★", async () => {
    const records = carrier("a turns in the records.", "b holds.");
    const disk = carrier("a holds.", "b turns on the disk.");
    const r = rig(disk, records, BASE);
    const taken = await takeDisk({ uri: URI, key: KEY }, r.deps);
    expect(taken).toMatchObject({ ok: true, uri: URI, bag: BAG, key: KEY });
    expect(r.waves).toHaveLength(1);
    const landed = r.waves[0]!.candidates[0]!.text ?? "";
    expect(landed).toContain("a turns in the records.");
    expect(landed).toContain("b turns on the disk.");
    // The file holds the merged words too, so the projector meets the disk and the records agreed.
    const onDisk = readFileSync(r.path, "utf8");
    expect(onDisk).toBe(landed);
  });

  test("★ two edits to one slot refuse by name; nothing writes and nothing lands ★", async () => {
    const records = carrier("a holds.", "b one way.");
    const disk = carrier("a holds.", "b the other way.");
    const r = rig(disk, records, BASE);
    const taken = await takeDisk({ uri: URI, key: KEY }, r.deps);
    expect(taken).toMatchObject({ ok: false, refusal: "slot-conflict" });
    expect((taken as { why: string }).why).toContain("#/b");
    expect(r.waves).toEqual([]);
    expect(readFileSync(r.path, "utf8")).toBe(disk);
  });

  test("★ the base reads from an older pool commit where a later commit took the hand's edit ★", async () => {
    const records = carrier("a turns in the records.", "b holds.");
    const disk = carrier("a holds.", "b turns on the disk.");
    const r = rig(disk, records, BASE, { history: "commits", later: [disk] });
    const taken = await takeDisk({ uri: URI, key: KEY }, r.deps);
    expect(taken).toMatchObject({ ok: true, merge: { kind: "slots" } });
    expect(readFileSync(r.path, "utf8")).toContain("a turns in the records.");
    expect(readFileSync(r.path, "utf8")).toContain("b turns on the disk.");
  });

  test("★ no text rests beside the synced tree: the base's words never leave the pool ★", async () => {
    const r = rig(carrier("a holds.", "b turns on the disk."), carrier("a turns in the records.", "b holds."), BASE);
    await takeDisk({ uri: URI, key: KEY }, r.deps);
    expect(readdirSync(join(tmp, "synced")).filter((f) => !f.endsWith(".json"))).toEqual([]);
  });

  test("CONTROL: a pool with no history lands the file whole and names why", async () => {
    const disk = carrier("a holds.", "b turns on the disk.");
    const r = rig(disk, carrier("a turns in the records.", "b holds."), BASE, { history: "none" });
    const taken = await takeDisk({ uri: URI, key: KEY }, r.deps);
    expect(taken).toMatchObject({ ok: true, merge: { kind: "whole" } });
    expect((taken as { merge: { why: string } }).merge.why).toMatch(/git/);
    expect(r.waves[0]!.candidates[0]!.text).toBe(disk);
  });

  test("CONTROL: where only the disk moved a slot past the base, the file lands as the hand left it", async () => {
    const disk = carrier("a holds.", "b turns on the disk.");
    const r = rig(disk, BASE, BASE);
    const taken = await takeDisk({ uri: URI, key: KEY }, r.deps);
    expect(taken).toMatchObject({ ok: true });
    expect(r.waves[0]!.candidates[0]!.text).toBe(disk);
    expect(readFileSync(r.path, "utf8")).toBe(disk);
  });
});
