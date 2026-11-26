/**
 * genesis-truths -- both truths in one line: the founding record (the stored genesis island) beside the seed
 * (offered) on disk and the floor accept, ratchet by ratchet.
 *
 * D1: the boot names a newer seed and serves the founding record unchanged; nothing moves at boot, and lay moves
 * canon, never the founding record. The read stays pure over what the caller hands it.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { repoRoot } from "@lararium/mesh/node";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh/lar-uris";
import { floorMountBlobRows, signFloorOffering } from "@lararium/mesh/floor-offering";
import { foundingRecordDigests } from "@lararium/mesh/genesis-compare";
import { type GenesisSeed } from "@lararium/mesh/genesis-doc";
import { foundingRecordLine, readFoundingRecordTruths } from "../src/genesis-truths.js";
import { genesisSeedCid, readGenesisSeedBytes } from "../src/genesis-artifact.js";

const SHIPPED = join(repoRoot, "genesis");
const shipped = (): GenesisSeed => JSON.parse(readFileSync(join(SHIPPED, "seed.json"), "utf8")) as GenesisSeed;
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** A genesis dir whose seed moves the grammar blob's bytes (a newer grammar offered). */
function grammarMovedDir(): string {
  const dir = mkdtempSync("/tmp/lararium-genesis-truths-"); dirs.push(dir);
  const seed = shipped();
  const blobs = { ...seed.blobs, [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: { ...seed.blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI]!, sha256: "f".repeat(64) } };
  mkdirSync(join(dir, "genesis"));
  writeFileSync(join(dir, "genesis", "seed.json"), JSON.stringify({ ...seed, blobs }));
  return join(dir, "genesis");
}

describe("the founding record beside the seed (offered)", () => {
  test("a founding record laid from the shipped seed reads same on every ratchet against it", () => {
    const line = foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: SHIPPED }));
    const cid = genesisSeedCid(readGenesisSeedBytes(SHIPPED)!);
    expect(line).toMatch(/^\[genesis\] founding record: engine \S+ · grammar \S+ · lararium \S+ · plugins \S+ · floor \S+/);
    expect(line).toContain(`seed (offered) ${cid}: same on every ratchet`);
    expect(line).not.toContain("a newer seed waits");
  });

  test("CONTROL: a seed whose grammar moved names the newer seed ratchet by ratchet, and says nothing moves", () => {
    const line = foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: grammarMovedDir() }));
    expect(line).toContain("a newer seed waits: engine same · grammar moved · lararium same · plugins same · floor same");
    expect(line).toContain("the founding record keeps serving; lay moves canon, never the founding record");
  });

  test("a genesis dir with no seed names the offer absent, never same", () => {
    const empty = mkdtempSync("/tmp/lararium-genesis-truths-"); dirs.push(empty);
    const line = foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: empty }));
    expect(line).toContain("seed (offered): none reads");
    expect(line).not.toContain("same on every ratchet");
  });

  test("the floor accept prints beside them, per ratchet, when the caller holds it", async () => {
    const record = foundingRecordDigests(shipped());
    // A accepted floor whose plugins offering carries a moved parser: grammar and plugins read moved through the offering.
    const rows = floorMountBlobRows(Object.values(shipped().blobs) as Array<{ id: string; version: string; sha256: string; mimeType: string }>);
    const offered = await signFloorOffering({ seed: new Uint8Array(32).fill(8), blobs: rows.map((r) => ({
      id: r.id, version: r.version, sha256: r.id === LARES_MEMETIC_WIKITEXT_PLUGIN_URI ? "f".repeat(64) : r.sha256,
      provenance: { source: "https://example.test", commit: "0".repeat(40), path: "p.json", licence: "MIT" },
    })) });
    const truths = readFoundingRecordTruths({
      record: shipped(), genesisDir: SHIPPED,
      floorAccept: { manifestCid: "a".repeat(64), manifest: { engine: record.engine!, plugins: offered.cid }, offering: offered.offering },
    });
    expect(foundingRecordLine(truths)).toContain(`floor accept ${"a".repeat(64)}: engine same · grammar moved · lararium same · plugins moved · floor moved`);
    // CONTROL: with no pin handed in, the line names the pin unread, never same.
    expect(foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: SHIPPED }))).toContain("floor accept: unread here");
  });
});

describe("a read-only print never stops a boot", () => {
  /** A genesis dir whose seed.json names the genesis format but carries a blob row the fold cannot read. */
  function oddSeedDir(): string {
    const dir = mkdtempSync("/tmp/lararium-genesis-truths-"); dirs.push(dir);
    mkdirSync(join(dir, "genesis"));
    writeFileSync(join(dir, "genesis", "seed.json"), JSON.stringify({ ...shipped(), blobs: { odd: null } }));
    return join(dir, "genesis");
  }

  test("RED: a record whose blobs make the fold refuse yields an unread line and no throw", () => {
    let line = "";
    expect(() => { line = foundingRecordLine(readFoundingRecordTruths({ record: { blobs: { odd: null } } as never, genesisDir: SHIPPED })); }).not.toThrow();
    expect(line).toMatch(/^\[genesis\] founding record: unread here \(.+\)$/);
  });

  test("RED: a null record yields an unread line and no throw", () => {
    let line = "";
    expect(() => { line = foundingRecordLine(readFoundingRecordTruths({ record: null as never, genesisDir: SHIPPED })); }).not.toThrow();
    expect(line).toMatch(/^\[genesis\] founding record: unread here \(.+\)$/);
  });

  test("RED: a seed.json the fold cannot read yields a line and no throw", () => {
    let line = "";
    expect(() => { line = foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: oddSeedDir() })); }).not.toThrow();
    expect(line).toMatch(/^\[genesis\] founding record: unread here \(.+\)$/);
  });

  test("CONTROL: a torn seed.json still reads the founding record and names the offer absent; the clean case reads same", () => {
    const torn = mkdtempSync("/tmp/lararium-genesis-truths-"); dirs.push(torn);
    mkdirSync(join(torn, "genesis")); writeFileSync(join(torn, "genesis", "seed.json"), "{ torn");
    expect(foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: join(torn, "genesis") }))).toContain("seed (offered): none reads");
    expect(foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: SHIPPED }))).toContain(": same on every ratchet");
  });
});
