/**
 * A HEAVY DOCUMENT LOADS FOLDED: THE DOUBLE TAKES THE HISTORY.
 *
 * Automerge's engine keeps memory for every change it replays onto a loaded document and never returns it inside one
 * engine. The house's durable store therefore hands the Repo a heavy document as ONE snapshot, folded in a throwaway child
 * process (the doc-load-probe child's `--fold` mode), and lists none of the incrementals that snapshot covers. The fold
 * changes how a document loads, never what rests.
 *
 *   F1  a synthetic heavy document (a snapshot and many overwrite incrementals): through the fold the live engine grows
 *       about as much as loading the compact snapshot does, far less than the plain load, at the same heads.
 *   F2  after the folded load and one write, every stored record rests byte for byte where it lay, beside exactly one new
 *       incremental (the write); no snapshot appears, and nothing rests under the folded snapshot's key.
 *   F3  a light document loads as it rests: no fold runs.
 *   F4  a document carrying a sealed record loads as it rests: no fold runs, every record listed under its own key.
 *   F5  a fold that fails (the double runs past its patience) falls back to the plain load at the same heads and names it.
 *
 * Every store is a scratch directory under the temp root; the meter (`fold-load-meter.mts`) reads the live engine in a
 * process of its own, so this suite's engine never colors a reading.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as A from "@automerge/automerge";
import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo";
import { sealedAddressOf, SEALED_VALUE_POINTER } from "@lararium/mesh";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";
import { makeChildProcessDocFold } from "../src/doc-load-probe.js";

const METER = join(__dirname, "fold-load-meter.mts");
const PACKAGE = join(__dirname, "..");

type Doc = { t: Record<string, { text: unknown }> };
interface Stored { readonly documentId: string; readonly heads: readonly string[]; readonly compact: Uint8Array }

const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const docDir = (store: string, documentId: string): string => join(store, documentId.slice(0, 2), documentId.slice(2));

/** Write a document the way the Repo rests one: a snapshot, then each change its own incremental. */
function storeHistory(store: string, tiddlers: number, overwrites: number, length: number): Stored {
  const { documentId } = parseAutomergeUrl(generateAutomergeUrl());
  const value = (i: number) => new A.ImmutableString(`e${i} `.repeat(length).slice(0, length));
  let doc = A.from<Doc>({ t: {} });
  doc = A.change(doc, (d) => { for (let i = 0; i < tiddlers; i++) d.t[`k${i}`] = { text: value(0) }; });
  const snapshot = A.save(doc);
  const dir = docDir(store, documentId);
  mkdirSync(join(dir, "snapshot"), { recursive: true });
  mkdirSync(join(dir, "incremental"), { recursive: true });
  writeFileSync(join(dir, "snapshot", sha(snapshot)), snapshot);
  doc = A.load<Doc>(snapshot);
  for (let i = 1; i <= overwrites; i++) {
    const heads = A.getHeads(doc);
    doc = A.change(doc, (d) => { d.t[`k${i % tiddlers}`]!.text = value(i); });
    const tail = A.saveSince(doc, heads);
    writeFileSync(join(dir, "incremental", sha(tail)), tail);
  }
  return { documentId, heads: A.getHeads(doc), compact: A.save(doc) };
}

/** Every record resting under a document: role/name → bytes digest. */
function resting(store: string, documentId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const role of ["snapshot", "incremental"]) {
    let names: string[] = [];
    try { names = readdirSync(join(docDir(store, documentId), role)); } catch { /* no such role rests */ }
    for (const name of names) out[`${role}/${name}`] = sha(readFileSync(join(docDir(store, documentId), role, name)));
  }
  return out;
}

interface Reading { readonly heads: string[]; readonly growthBytes: number; readonly events: Array<Record<string, unknown>> }

function meter(store: string, documentId: string, mode: "plain" | "fold" | "fold-impatient", after?: "write"): Reading {
  const run = spawnSync(process.execPath, ["--import", "tsx", METER, store, documentId, mode, ...(after ? [after] : [])], {
    cwd: PACKAGE, encoding: "utf8", timeout: 120_000, maxBuffer: 64 * 2 ** 20,
  });
  if (run.status !== 0) throw new Error(`meter ${mode} exited ${run.status ?? run.signal}: ${run.stderr}`);
  return JSON.parse(run.stdout.trim().split("\n").pop()!) as Reading;
}

let root = "";
beforeAll(() => { root = mkdtempSync(join(tmpdir(), "fold-at-load-")); });
afterAll(() => { if (root) rmSync(root, { recursive: true, force: true }); });

describe("a heavy document loads folded", () => {
  test("F1 + F2: the live engine grows near the compact figure at the same heads, and every record rests as it lay", () => {
    const store = join(root, "heavy");
    const heavy = storeHistory(store, 1_000, 160, 2_500);
    const compactStore = join(root, "compact");
    const compactDir = docDir(compactStore, heavy.documentId);
    mkdirSync(join(compactDir, "snapshot"), { recursive: true });
    writeFileSync(join(compactDir, "snapshot", sha(heavy.compact)), heavy.compact);

    const plain = meter(store, heavy.documentId, "plain");
    const compact = meter(compactStore, heavy.documentId, "plain");
    const before = resting(store, heavy.documentId);
    const folded = meter(store, heavy.documentId, "fold", "write");
    const after = resting(store, heavy.documentId);

    for (const r of [plain, compact, folded]) expect([...r.heads].sort()).toEqual([...heavy.heads].sort());
    expect(folded.events).toEqual([expect.objectContaining({ documentId: heavy.documentId, outcome: "folded" })]);
    // The plain load pays the replay; the folded one lands within a small margin of the compact load.
    expect(plain.growthBytes).toBeGreaterThan(4 * compact.growthBytes);
    expect(folded.growthBytes).toBeLessThan(compact.growthBytes + 16 * 2 ** 20);
    expect(folded.growthBytes * 4).toBeLessThan(plain.growthBytes);

    // F2: what rested still rests, byte for byte; the write added one incremental and nothing else.
    for (const [name, digest] of Object.entries(before)) expect(after[name]).toBe(digest);
    const added = Object.keys(after).filter((name) => !(name in before));
    expect(added).toHaveLength(1);
    expect(added[0]!.startsWith("incremental/")).toBe(true);
  }, 240_000);

  test("F3: a light document loads as it rests", async () => {
    const store = join(root, "light");
    const light = storeHistory(store, 50, 10, 200);
    const events: unknown[] = [];
    const adapter = new DurableNodeFSStorageAdapter(store, { fold: { door: makeChildProcessDocFold(), onFold: (e) => { events.push(e); } } });
    const snapshots = await adapter.loadRange([light.documentId, "snapshot"]);
    const incrementals = await adapter.loadRange([light.documentId, "incremental"]);
    expect(snapshots.length + incrementals.length).toBe(Object.keys(resting(store, light.documentId)).length);
    expect(events).toEqual([]);
  });

  test("F4: a document carrying a sealed record loads as it rests", async () => {
    const store = join(root, "sealed");
    const heavy = storeHistory(store, 1_000, 160, 2_500);
    const pointer = new TextEncoder().encode(SEALED_VALUE_POINTER + sealedAddressOf(new Uint8Array(64).fill(9)));
    writeFileSync(join(docDir(store, heavy.documentId), "incremental", sha(pointer)), pointer);
    const events: unknown[] = [];
    const adapter = new DurableNodeFSStorageAdapter(store, { fold: { door: makeChildProcessDocFold(), onFold: (e) => { events.push(e); } } });
    const listed = [
      ...(await adapter.loadRange([heavy.documentId, "snapshot"])),
      ...(await adapter.loadRange([heavy.documentId, "incremental"])),
    ].map((chunk) => `${chunk.key[1]}/${chunk.key[2]}`).sort();
    expect(listed).toEqual(Object.keys(resting(store, heavy.documentId)).sort());
    expect(events).toEqual([]);
  });

  test("F5: a fold that fails falls back to the plain load at the same heads, and names it", () => {
    const store = join(root, "impatient");
    const heavy = storeHistory(store, 1_000, 160, 2_500);
    const before = resting(store, heavy.documentId);
    const reading = meter(store, heavy.documentId, "fold-impatient");
    expect([...reading.heads].sort()).toEqual([...heavy.heads].sort());
    expect(reading.events).toEqual([expect.objectContaining({ documentId: heavy.documentId, outcome: "unfolded", reason: expect.stringMatching(/patience/) })]);
    expect(resting(store, heavy.documentId)).toEqual(before);
  }, 240_000);
});
