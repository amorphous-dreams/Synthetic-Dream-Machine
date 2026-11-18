/**
 * TAKE-DISK MERGES BY SLOT AGAINST THE LAST AGREEMENT.
 *
 * A standoff stands where the file and the records both moved past their last agreement. `shore take-disk` once
 * landed the WHOLE file, so a records-side edit to one slot vanished when the disk side edited another (the
 * tideline rehearsal, research/tideline-surface #/rehearsal). The door now merges the three sides through the one
 * seal merge (`@lararium/mesh/meme-merge`): the base the synced tree keeps beside its row, the records' render the
 * island weighed under the key, and the file as the hand left it. A clean merge re-seals, writes the file and lands
 * through the ingest leg; two edits to one slot refuse by name, and nothing writes or lands on either side.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/** A scratch mirror whose file holds `disk`, a synced base row at it holding `base`, and an island that weighed `records`. */
function rig(disk: string, records: string, base: string | null): { path: string; waves: SubmitIngestOpts[]; deps: TakeDiskDeps } {
  tmp = mkdtempSync(join(tmpdir(), "take-disk-merge-"));
  const dir = join(tmp, "bags", "x", "ha.ka.ba", "x");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "merge-note.mem");
  writeFileSync(path, disk);
  const tree = new SyncedTree(join(tmp, "synced"));
  if (base !== null) tree.set(syncedTreeKey(BAG, URI), path, carrierHash(base), carrierHash(base), undefined, base);
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

  test("CONTROL: where only the disk moved a slot past the base, the file lands as the hand left it", async () => {
    const disk = carrier("a holds.", "b turns on the disk.");
    const r = rig(disk, BASE, BASE);
    const taken = await takeDisk({ uri: URI, key: KEY }, r.deps);
    expect(taken).toMatchObject({ ok: true });
    expect(r.waves[0]!.candidates[0]!.text).toBe(disk);
    expect(readFileSync(r.path, "utf8")).toBe(disk);
  });
});
