/**
 * genesis-truths -- both truths in one line: the founding record (the stored genesis island) beside the seed
 * (offered) on disk and the floor pin, ratchet by ratchet.
 *
 * D1: the boot names a newer seed and serves the founding record unchanged; nothing moves at boot, and lay moves
 * canon, never the founding record. The read stays pure over what the caller hands it.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { repoRoot } from "@lararium/mesh/node";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI, foundingRecordDigests, type GenesisSeed } from "@lararium/mesh";
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
    expect(line).toMatch(/^\[genesis\] founding record: engine \S+ · grammar \S+ · plugins \S+ · floor \S+/);
    expect(line).toContain(`seed (offered) ${cid}: same on every ratchet`);
    expect(line).not.toContain("a newer seed waits");
  });

  test("CONTROL: a seed whose grammar moved names the newer seed ratchet by ratchet, and says nothing moves", () => {
    const line = foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: grammarMovedDir() }));
    expect(line).toContain("a newer seed waits: engine same · grammar moved · plugins same · floor same");
    expect(line).toContain("the founding record keeps serving; lay moves canon, never the founding record");
  });

  test("a genesis dir with no seed names the offer absent, never same", () => {
    const empty = mkdtempSync("/tmp/lararium-genesis-truths-"); dirs.push(empty);
    const line = foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: empty }));
    expect(line).toContain("seed (offered): none reads");
    expect(line).not.toContain("same on every ratchet");
  });

  test("the floor pin prints beside them, per ratchet, when the caller holds it", () => {
    const record = foundingRecordDigests(shipped());
    const truths = readFoundingRecordTruths({
      record: shipped(), genesisDir: SHIPPED,
      floorPin: { manifestCid: "a".repeat(64), manifest: { engine: record.engine!, grammar: "bafkreimoved", plugins: record.plugins! } },
    });
    expect(foundingRecordLine(truths)).toContain(`floor pin ${"a".repeat(64)}: engine same · grammar moved · plugins same · floor moved`);
    // CONTROL: with no pin handed in, the line names the pin unread, never same.
    expect(foundingRecordLine(readFoundingRecordTruths({ record: shipped(), genesisDir: SHIPPED }))).toContain("floor pin: unread here");
  });
});
