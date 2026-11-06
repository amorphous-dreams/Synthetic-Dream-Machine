/**
 * e2e/sealed-wiki-restart — a write to a sealed wiki bag survives a stand-down at once and a restart, and rests as no
 * clear byte (lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed, R1 · R2 · T3).
 *
 * THE STAND, as `sealed-session-store`: A founds its hearth and a Nexus key; B, a vessel of the same face, lands A's
 * fleet-join answer and dials A's Nexus, so B's worn face's wiki bags map sealed while that chain stands.
 *
 *   R1 — POSITIVE FIRST: a marker put into the daemon wiki (a bag that rests clear) reads back off B's store files, so
 *        the scan reads what rests
 *   R2 — B puts a marker into its face's working bag through the meme door, and B stands down at once
 *   R3 — at rest, no file of B's document store holds the sealed marker
 *   R4 — B restarts over the same root, unlocks, crosses A's gate again, and reads the marker back whole
 *
 * THE RUN (2026-11-05, bwrap PID namespace, scratch LAR_ROOT, no LAR_BAGS): R4's read-back lands whole; R3 and R4's rest
 * checks RED. The marker rests clear in the vessel store's own snapshot of the document the meme door wrote (the map
 * named no sealed bag for it), in the wiki island's own store (`lares/`) and in the daemon island's owned store
 * (`daemon-owned/`): the island-owned Repos and the meme door's bag stay owed (sealed-store#/owed, T2). Declared red
 * until those land: it runs where `LAR_E2E_SEALED_RESTART=1` names it, and the lane that seals them lifts the gate.
 *
 * The suite runs only in a STAGED target: it founds two vessels and never touches a live hearth.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStaged, openStagedJoinee, vesselStorageDir, type LarInstance, type StagedJoinee } from "../harness/instance.js";
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
/** Every file under `dir` that holds `needle`'s bytes. */
function filesHolding(dir: string, needle: string): string[] {
  const want = Buffer.from(needle);
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      const st = statSync(path);
      if (st.isDirectory()) walk(path);
      else if (st.isFile() && readFileSync(path).includes(want)) out.push(path);
    }
  };
  walk(dir);
  return out;
}

beforeAll(async () => {
  if (!staged) return;
  pair = await openStagedJoinee({ tag: "sealed-restart", riteA: async (_cli, rootA) => { await mintStagedNexusKey(rootA); } });
  if (!pair.B) throw new Error(`B never stood: ${pair.joinGate ?? ""}`);
  await crossed(pair.B);
}, 600_000);

afterAll(async () => { await B2?.stopDaemonOnly(); await pair?.stop(); });

describe.runIf(staged && process.env["LAR_E2E_SEALED_RESTART"] === "1")("a sealed wiki write survives a stand-down at once and a restart", () => {
  test("R1-R3 — the positive control reads a clear marker at rest; the sealed marker rests as no clear byte after a stand-down at once", async () => {
    const B = pair!.B!;
    const clear = await B.cli(["meme", "put", CLEAR_URI, "--recipe", "default", "--file", memeFile(CLEAR_URI, CLEAR_MARK), "--json"]);
    expect(clear.code, clear.stderr + clear.stdout).toBe(0);
    const put = await B.cli(["meme", "put", SEALED_URI, "--recipe", "lares", "--file", memeFile(SEALED_URI, SEALED_MARK), "--json"]);
    expect(put.code, put.stderr + put.stdout).toBe(0);
    // THE STAND-DOWN AT ONCE: no wait past the put's own answer.
    await B.stopDaemonOnly();
    const store = vesselStorageDir(B);
    // barrier: the stand-down's own exit (stopDaemonOnly resolves once the daemon process left).
    expect(filesHolding(store, CLEAR_MARK).length, `the scan reads ${store}`).toBeGreaterThan(0);
    expect(filesHolding(store, SEALED_MARK).map((f) => f.slice(store.length))).toEqual([]);
  }, 300_000);

  test("R4 — B restarts, unlocks, crosses again, and reads the sealed marker back whole", async () => {
    B2 = await openStaged({ tag: "sealed-restart-B2", root: pair!.rootB, port: pair!.portB, found: async () => {} });
    await crossed(B2);
    let text = "";
    const deadline = performance.now() + 120_000;
    while (performance.now() < deadline) {
      const got = await B2.cli(["meme", "get", SEALED_URI, "--recipe", "lares", "--json"]);
      text = got.stdout + got.stderr;
      if (got.code === 0 && text.includes(SEALED_MARK)) break;
      await new Promise((r) => setTimeout(r, 2_000));
    }
    expect(text, B2.bootLog().slice(-3000)).toContain(SEALED_MARK);
    expect(filesHolding(vesselStorageDir(B2), SEALED_MARK).map((f) => f.slice(vesselStorageDir(B2).length))).toEqual([]);
  }, 300_000);
});
