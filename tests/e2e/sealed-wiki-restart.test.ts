/**
 * e2e/sealed-wiki-restart — a write to a sealed wiki bag survives a stand-down at once and a restart, and rests as no
 * clear byte outside the operator's own disk projection (lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed, R1 · R2 ·
 * T3 · V2 · V3 · V6).
 *
 * THE STAND, as `sealed-session-store`: A founds its hearth and a Nexus key; B, a vessel of the same face, lands A's
 * fleet-join answer and dials A's Nexus, so B's worn face's wiki bags map sealed while that chain stands, and the dial's
 * own session stands seated in B's book (V6).
 *
 *   R1 — POSITIVE FIRST: a marker placed into the daemon document by name (`--bag daemon`, the floor half that rests
 *        clear) reads back off B's store, so the scan reads what rests
 *   R2 — B puts a marker into its face's working bag through the meme door, and B stands down at once
 *   R3 — at rest, no file of B's root outside the disk projection (`bags/`, `wikis/`, the operator's cleartext) holds
 *        the sealed marker: not the vessel's own store (V3: the map names the working slot's document), not the wiki
 *        island's store nor the daemon island's owned store (V2: an island rests no document the vessel seals)
 *   R4 — B restarts over the same root, unlocks and crosses A's gate again: the restart's hydration rests nothing clear
 *        (a sealed document's load waits for its map), and the marker reads back whole
 *   R5 — after the read-back, no store outside the projection holds the marker clear: the verb outcome ledger that carries
 *        the read's answer to the CLI rests in the vessel's control document (`bags/control/outcomes/<id>`), which seals
 *        beside the secret home under the vessel's key, and the daemon document rests no outcome body. The control
 *        document names no mirror (placement over patterns), so every byte of the ledger rests in a store, never in `bags/`
 *   R6 — the face's own catalog (U1's D half of the catalog) rests sealed: it opened only after the daemon island's
 *        holder stood, and the restart read the marker back through it (R4). POSITIVE FIRST: the floor's catalog, which
 *        rests clear, holds its rows' titles in its document's rest, so the scan reads a catalog's rest; then no file of
 *        the face catalog's document holds a clear row title, while its document rests there
 *
 * The suite runs only in a STAGED target: it founds two vessels and never touches a live hearth.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootDocUrl, openStaged, openStagedJoinee, vesselStorageDir, type LarInstance, type StagedJoinee } from "../harness/instance.js";
import { mintStagedNexusKey } from "../harness/vessel-key.js";

// The Automerge core the repo package itself loads, for the scan's reading of a compacted rest.
type Am = { init(): unknown; from(o: object): unknown; change(d: unknown, f: (x: Record<string, unknown>) => void): unknown; save(d: unknown): Uint8Array; loadIncremental(d: unknown, b: Uint8Array): unknown; toJS(d: unknown): unknown };
const A = createRequire(createRequire(import.meta.url).resolve("@automerge/automerge-repo"))("@automerge/automerge") as Am;

const AUTOMERGE_MAGIC = Buffer.from([0x85, 0x6f, 0x4a, 0x83]);
const staged = process.env["LAR_TARGET"] !== "live";
const SEALED_MARK = `sealed-heron-${process.pid}-${Date.now()}`;
const CLEAR_MARK = `clear-heron-${process.pid}-${Date.now()}`;
const SEALED_URI = `lar:///ha.ka.ba/lares/scratch/sealed-restart-${process.pid}`;
const CLEAR_URI = `lar:///ha.ka.ba/lares/scratch/clear-restart-${process.pid}`;

let pair: StagedJoinee | null = null;
let B2: LarInstance | null = null;
const scratch = mkdtempSync(join(tmpdir(), "sealed-wiki-restart-"));

async function crossed(v: LarInstance): Promise<void> {
  const line = "[lar-leaf] verdict OK — crossing open";
  const deadline = performance.now() + 90_000;
  while (!v.bootLog().includes(line) && performance.now() < deadline) await new Promise((r) => setTimeout(r, 250));
  if (!v.bootLog().includes(line)) throw new Error(`B never crossed A's gate:\n${v.bootLog().slice(-2000)}`);
}
function memeFile(uri: string, text: string): string {
  const path = join(scratch, `${uri.split("/").at(-1)}.mem`);
  writeFileSync(path, `<<!DOCTYPE type=\`memetic-wikitext+tiddlywiki\` spec=\`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext\`>>\n\n${text}\n`);
  return path;
}
/**
 * Every file under `dir` that holds `needle`'s bytes, its path relative to `dir`: in its raw bytes, or in the document its
 * rest decodes to. A store compacts a document's chunks into one snapshot, and a snapshot deflates every column past 256
 * bytes, so a raw read misses a marker that rests clear there. So the chunks of each document directory (the parent of its
 * `snapshot/` and `incremental/` folders) decode together, and each chunk of a document that decodes holding the needle
 * reads as holding it. A sealed chunk carries no Automerge magic and decodes to nothing here.
 */
function filesHolding(dir: string, needle: string): string[] {
  const want = Buffer.from(needle);
  const out = new Set<string>();
  const docs = new Map<string, Array<{ rel: string; bytes: Buffer }>>();
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      const st = statSync(path, { throwIfNoEntry: false });
      if (!st) continue;
      if (st.isDirectory()) { walk(path); continue; }
      if (!st.isFile()) continue;
      const bytes = readFileSync(path);
      const rel = path.slice(dir.length + 1);
      if (bytes.includes(want)) out.add(rel);
      if (bytes.subarray(0, 4).equals(AUTOMERGE_MAGIC)) {
        const docDir = join(d, "..");
        docs.set(docDir, [...(docs.get(docDir) ?? []), { rel, bytes }]);
      }
    }
  };
  walk(dir);
  for (const chunks of docs.values()) {
    let doc = A.init();
    const loaded: string[] = [];
    for (const c of chunks.sort((a, b) => (a.rel < b.rel ? 1 : -1))) {   // snapshot/ before incremental/
      try { doc = A.loadIncremental(doc, new Uint8Array(c.bytes)); loaded.push(c.rel); } catch { /* not a chunk this core reads */ }
    }
    if (loaded.length > 0 && JSON.stringify(A.toJS(doc)).includes(needle)) for (const rel of loaded) out.add(rel);
  }
  return [...out].sort();
}
/**
 * The rows one document's rest decodes to, read by a fresh Repo over a copy of that document's shard alone (id[:2] /
 * id[2:]): a clear rest loads its tiddlers; a sealed rest decodes to none (its chunks open under no key here). Null when
 * the store holds no shard for it.
 */
async function rowsAtRest(store: string, url: string): Promise<number | null> {
  const id = url.replace(/^automerge:/, "");
  const shard = join(store, id.slice(0, 2), id.slice(2));
  if (!statSync(shard, { throwIfNoEntry: false })?.isDirectory()) return null;
  const copy = mkdtempSync(join(tmpdir(), "rest-read-"));
  cpSync(shard, join(copy, id.slice(0, 2), id.slice(2)), { recursive: true });
  const repo = new Repo({ storage: new NodeFSStorageAdapter(copy), network: [] });
  try {
    const handle = await Promise.race([
      repo.find<{ tiddlers?: Record<string, unknown> }>(url as AutomergeUrl),
      new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
    ]);
    return handle ? Object.keys(handle.doc()?.tiddlers ?? {}).length : 0;
  } catch { return 0; }
  finally { await repo.shutdown().catch(() => undefined); }
}
/** The operator's own cleartext: the bare disk projection under the root's `projections/` (R1's carve-out). */
const projected = (rel: string): boolean => rel.startsWith("projections/");
/** Every file of the root OUTSIDE the disk projection that holds the sealed marker. */
const restingClear = (root: string): string[] => filesHolding(root, SEALED_MARK).filter((rel) => !projected(rel));

beforeAll(async () => {
  if (!staged) return;
  pair = await openStagedJoinee({ tag: "sealed-restart", riteA: async (_cli, rootA) => { await mintStagedNexusKey(rootA); } });
  if (!pair.B) throw new Error(`B never stood: ${pair.joinGate ?? ""}`);
  await crossed(pair.B);
}, 600_000);

afterAll(async () => { await B2?.stopDaemonOnly(); await pair?.stop(); });

test("CONTROL — the scan reads a clear marker in a compacted rest, where the snapshot deflates its columns", () => {
  // A store compacts a document's chunks into one snapshot whenever its incremental bytes outgrow it, and a snapshot
  // deflates every column past 256 bytes: the marker's bytes leave the file while the rest still holds it clear.
  const store = mkdtempSync(join(tmpdir(), "compacted-rest-"));
  let doc = A.from({ tiddlers: {} });
  for (let i = 0; i < 64; i++) doc = A.change(doc, (d) => { (d["tiddlers"] as Record<string, unknown>)[`t${i}`] = { text: `filler ${"x".repeat(64)} ${i}` }; });
  doc = A.change(doc, (d) => { (d["tiddlers"] as Record<string, unknown>)["m"] = { text: CLEAR_MARK }; });
  const snapshot = A.save(doc);
  expect(Buffer.from(snapshot).includes(Buffer.from(CLEAR_MARK)), "the plant deflates the marker").toBe(false);
  mkdirSync(join(store, "ab", "cdef", "snapshot"), { recursive: true });
  writeFileSync(join(store, "ab", "cdef", "snapshot", "h1"), snapshot);
  expect(filesHolding(store, CLEAR_MARK)).toEqual(["ab/cdef/snapshot/h1"]);
});

describe.runIf(staged)("a sealed wiki write survives a stand-down at once and a restart", () => {
  test("R1-R3 — the positive control reads a clear marker at rest; the sealed marker rests as no clear byte after a stand-down at once", async () => {
    const B = pair!.B!;
    // The daemon wiki's working slot seals under the lit face (U1's D half); the daemon document beneath stays the floor's.
    const clear = await B.cli(["meme", "put", CLEAR_URI, "--bag", "daemon", "--file", memeFile(CLEAR_URI, CLEAR_MARK), "--json"]);
    expect(clear.code, clear.stderr + clear.stdout).toBe(0);
    const put = await B.cli(["meme", "put", SEALED_URI, "--recipe", "lares", "--file", memeFile(SEALED_URI, SEALED_MARK), "--json"]);
    expect(put.code, put.stderr + put.stdout).toBe(0);
    // THE STAND-DOWN AT ONCE: no wait past the put's own answer.
    await B.stopDaemonOnly();
    // barrier: the stand-down's own exit (stopDaemonOnly resolves once the daemon process left).
    const store = vesselStorageDir(B);
    expect(filesHolding(store, CLEAR_MARK).length, `the scan reads ${store}`).toBeGreaterThan(0);
    console.log(`[sealed-restart] the projection holds the sealed marker at: ${JSON.stringify(filesHolding(pair!.rootB, SEALED_MARK).filter(projected))}`);
    expect(restingClear(pair!.rootB)).toEqual([]);
  }, 300_000);

  test("R4 — B restarts, unlocks and crosses again: the marker still rests as no clear byte after the restart's hydration, and reads back whole", async () => {
    B2 = await openStaged({ tag: "sealed-restart-B2", root: pair!.rootB, port: pair!.portB, found: async () => {} });
    await crossed(B2);
    // THE HYDRATION READ NOTHING CLEAR BACK TO REST: no island and no store rests the marker before any read.
    expect(restingClear(pair!.rootB)).toEqual([]);
    let text = "";
    const deadline = performance.now() + 120_000;
    while (performance.now() < deadline) {
      const got = await B2.cli(["tiddler", "get", SEALED_URI, "--recipe", "lares", "--meme", "--all", "--json"]);
      text = got.stdout + got.stderr;
      if (got.code === 0 && text.includes(SEALED_MARK)) break;
      await new Promise((r) => setTimeout(r, 2_000));
    }
    expect(text, B2.bootLog().slice(-3000)).toContain(SEALED_MARK);
  }, 300_000);

  test("R5 — after the read-back, no store outside the disk projection holds the marker clear: the outcome ledger rests sealed in the control document, and the daemon document rests no outcome body", async () => {
    const daemonUrl = bootDocUrl(B2!, "daemon");
    expect(daemonUrl, "the boot names its daemon document").not.toBeNull();
    await B2!.stopDaemonOnly();
    // barrier: the stand-down's own exit (stopDaemonOnly resolves once the daemon process left).
    expect(restingClear(pair!.rootB)).toEqual([]);
  }, 120_000);

  test("R6 — the face's own catalog rests sealed: the floor's catalog decodes to its rows at rest (positive), the face's decodes to none", async () => {
    const store = vesselStorageDir(B2!);
    const floorUrl = bootDocUrl(B2!, "catalog");
    const faceUrl = /\[catalog\] the face's own catalog stands: (automerge:[A-Za-z0-9]+)/.exec(B2!.bootLog())?.[1] ?? null;
    expect(floorUrl, "the boot names its floor catalog").not.toBeNull();
    expect(faceUrl, B2!.bootLog().slice(-3000)).not.toBeNull();
    // POSITIVE FIRST: a catalog that rests clear decodes to its rows off its rest alone.
    expect(await rowsAtRest(store, floorUrl!), `the floor catalog's rest at ${floorUrl}`).toBeGreaterThan(0);
    // barrier: the face's catalog rests at its own shard (a scan of nothing proves nothing).
    const faceRows = await rowsAtRest(store, faceUrl!);
    expect(faceRows, `the face catalog's rest at ${faceUrl}`).not.toBeNull();
    expect(faceRows, "the face catalog decodes to no clear row at rest").toBe(0);
  }, 60_000);
});
