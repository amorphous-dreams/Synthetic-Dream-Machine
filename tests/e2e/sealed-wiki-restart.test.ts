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
 *        the read's answer to the CLI rests in the daemon wiki's working slot, which seals under the lit face (U1's D
 *        half), and the daemon document rests no outcome body. The ledger's titles (`bags/daemon/outcomes/<id>`) name
 *        tiddlers that never project (`disk-projection: no`), so every byte of them rests in a store, never in `bags/`
 *
 * The suite runs only in a STAGED target: it founds two vessels and never touches a live hearth.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootDocUrl, openStaged, openStagedJoinee, vesselStorageDir, type LarInstance, type StagedJoinee } from "../harness/instance.js";
import { mintStagedNexusKey } from "../harness/vessel-key.js";

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
/** Every file under `dir` that holds `needle`'s bytes, its path relative to `dir`. */
function filesHolding(dir: string, needle: string): string[] {
  const want = Buffer.from(needle);
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      const st = statSync(path, { throwIfNoEntry: false });
      if (!st) continue;
      if (st.isDirectory()) walk(path);
      else if (st.isFile() && readFileSync(path).includes(want)) out.push(path.slice(dir.length + 1));
    }
  };
  walk(dir);
  return out;
}
/** The operator's own cleartext: the bare disk projection under the root's `bags/` and `wikis/` (R1's carve-out). */
const projected = (rel: string): boolean => rel.startsWith("bags/") || rel.startsWith("wikis/");
/** Every file of the root OUTSIDE the disk projection that holds the sealed marker. */
const restingClear = (root: string): string[] => filesHolding(root, SEALED_MARK).filter((rel) => !projected(rel));

beforeAll(async () => {
  if (!staged) return;
  pair = await openStagedJoinee({ tag: "sealed-restart", riteA: async (_cli, rootA) => { await mintStagedNexusKey(rootA); } });
  if (!pair.B) throw new Error(`B never stood: ${pair.joinGate ?? ""}`);
  await crossed(pair.B);
}, 600_000);

afterAll(async () => { await B2?.stopDaemonOnly(); await pair?.stop(); });

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
      const got = await B2.cli(["meme", "get", SEALED_URI, "--recipe", "lares", "--json"]);
      text = got.stdout + got.stderr;
      if (got.code === 0 && text.includes(SEALED_MARK)) break;
      await new Promise((r) => setTimeout(r, 2_000));
    }
    expect(text, B2.bootLog().slice(-3000)).toContain(SEALED_MARK);
  }, 300_000);

  test("R5 — after the read-back, no store outside the disk projection holds the marker clear: the outcome ledger rests sealed under the lit face, and the daemon document rests no outcome body", async () => {
    const daemonUrl = bootDocUrl(B2!, "daemon");
    expect(daemonUrl, "the boot names its daemon document").not.toBeNull();
    await B2!.stopDaemonOnly();
    // barrier: the stand-down's own exit (stopDaemonOnly resolves once the daemon process left).
    expect(restingClear(pair!.rootB)).toEqual([]);
  }, 120_000);
});
