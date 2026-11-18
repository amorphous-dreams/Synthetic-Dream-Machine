/**
 * floor-seed -- `lares vessel floor seed`: the seed a genesis dir offers (its CID and digests) beside the founding record's
 * digests where a house answers, ratchet by ratchet (D1). The image carries its genesis at `/app/genesis` (LAR_GENESIS), so
 * the shim reads what an image offers through this one read and hands its line to the pūlama (`image '{"digest","seed"}'`).
 * It reads and moves nothing.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { repoRoot } from "@lararium/mesh/node";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI, foundingRecordDigests, type GenesisSeed } from "@lararium/mesh";
import { genesisSeedCid } from "@lararium/node";
import { floorSeedRead, readSeedOffered } from "../src/seed-offered.js";
import { cmdFloor, floorSeedLines } from "../src/commands/floor.js";
import { parseArgs } from "../src/parse-args.js";

const SHIPPED = join(repoRoot, "genesis");
const shippedBytes = (): Buffer => readFileSync(join(SHIPPED, "seed.json"));
const shipped = (): GenesisSeed => JSON.parse(shippedBytes().toString("utf8")) as GenesisSeed;
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** A scratch genesis dir holding `bytes` as its seed.json. */
function genesisDirWith(bytes: string | Buffer): string {
  const root = mkdtempSync("/tmp/lares-floor-seed-"); dirs.push(root);
  mkdirSync(join(root, "genesis"));
  writeFileSync(join(root, "genesis", "seed.json"), bytes);
  return join(root, "genesis");
}

/** A seed whose grammar blob's bytes moved: a newer grammar offered. */
function grammarMovedBytes(): string {
  const seed = shipped();
  const blobs = { ...seed.blobs, [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: { ...seed.blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI]!, sha256: "f".repeat(64) } };
  return JSON.stringify({ ...seed, blobs });
}

describe("`lares vessel floor seed` prints the read", () => {
  test("RED: the verb reads the named genesis dir and answers the seed line and the offer fields under --json; CONTROL: the human lines name the seed and its CID", async () => {
    const dir = genesisDirWith(shippedBytes());
    const cid = genesisSeedCid(new Uint8Array(shippedBytes()));
    const out: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => { out.push(String(chunk)); return true; }) as typeof process.stdout.write;
    let code: number;
    try { code = await cmdFloor(parseArgs(["floor", "seed", "--genesis", dir, "--json"])); }
    finally { process.stdout.write = write; }
    expect(code).toBe(0);
    const answer = JSON.parse(out.join("").trim().split("\n").at(-1)!) as { ok: boolean; data: Record<string, unknown> };
    expect(answer.ok).toBe(true);
    expect(answer.data["genesis"]).toBe(dir);
    expect(answer.data["offered"]).toEqual({ cid, digests: foundingRecordDigests(shipped()) });
    expect(String(answer.data["seed"])).toMatch(new RegExp(`^seed ${cid}: `));
    const lines = floorSeedLines({ genesis: dir, offered: { cid, digests: foundingRecordDigests(shipped()) }, offer: null, ratchets: null, recordUnread: "no vessel answers", seed: `seed ${cid}: the founding record unread here (no vessel answers)` });
    expect(lines).toContain(`  seed (offered):  ${cid} at ${dir}`);
    expect(lines).toContain("  founding record: unread here (no vessel answers)");
  });
});

describe("the seed a genesis dir offers, beside the founding record", () => {
  test("RED: the same seed reads its CID and digests, same on every ratchet as the founding record", async () => {
    const dir = genesisDirWith(shippedBytes());
    const record = foundingRecordDigests(shipped());
    const cid = genesisSeedCid(new Uint8Array(shippedBytes()));
    expect(readSeedOffered(dir)).toEqual({ cid, digests: record });
    const read = await floorSeedRead({ genesisDir: dir, record: async () => ({ record }) });
    expect(read).toMatchObject({ genesis: dir, offer: { record, seed: { cid, digests: record } }, ratchets: "engine same · grammar same · plugins same · floor same" });
    expect(read.seed).toBe(`seed ${cid}: same on every ratchet as the founding record`);
  });

  test("RED: a newer seed names what waits, ratchet by ratchet, and says the founding record keeps serving", async () => {
    const bytes = grammarMovedBytes();
    const dir = genesisDirWith(bytes);
    const record = foundingRecordDigests(shipped());
    const cid = genesisSeedCid(new TextEncoder().encode(bytes));
    const read = await floorSeedRead({ genesisDir: dir, record: async () => ({ record }) });
    expect(read.offer?.seed.cid).toBe(cid);
    expect(read.ratchets).toBe("engine same · grammar moved · plugins same · floor same");
    expect(read.seed).toBe(`seed ${cid}: a newer seed waits: engine same · grammar moved · plugins same · floor same; the founding record keeps serving`);
  });

  test("CONTROL: no house answers: the seed still reads, the line names the founding record unread and its reason, and no offer pairs", async () => {
    const dir = genesisDirWith(shippedBytes());
    const cid = genesisSeedCid(new Uint8Array(shippedBytes()));
    const read = await floorSeedRead({ genesisDir: dir, record: async () => ({ unread: "no vessel answers" }) });
    expect(read.offer).toBeNull();
    expect(read.offered).toEqual({ cid, digests: foundingRecordDigests(shipped()) });
    expect(read.ratchets).toBeNull();
    expect(read.seed).toBe(`seed ${cid}: the founding record unread here (no vessel answers)`);
  });

  test("CONTROL: a dir holding no seed (or one not shaped as a genesis seed) reads none, never same", async () => {
    const empty = mkdtempSync("/tmp/lares-floor-seed-"); dirs.push(empty);
    expect(readSeedOffered(empty)).toBeNull();
    expect(readSeedOffered(genesisDirWith(JSON.stringify({ format: "not-a-seed" })))).toBeNull();
    const read = await floorSeedRead({ genesisDir: empty, record: async () => ({ record: foundingRecordDigests(shipped()) }) });
    expect(read.offer).toBeNull();
    expect(read.seed).toBe(`no seed reads at ${empty}`);
  });
});
