/**
 * land-persona-root — a restore lands a CARRIED persona root: the root row, then the roster line that commits it.
 *
 *   L1  a carried root lands with its roster line; the same root again changes nothing.
 *   L2  a root row or a roster line under ANOTHER key at the index refuses `names-another-key`, bytes untouched.
 *   L3  a keypair whose public half its seed does not derive refuses before any write.
 *   L4  an orphan root row (a root with no roster line) reads its key; an index with a roster line, or with
 *       nothing, reads none.
 *
 * Scratch custody, synthetic keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as ed from "@noble/ed25519";
import { hex } from "@lararium/mesh";
import { CustodyRowUnavailable } from "../src/custody-holder.js";
import { removeCustodyRow } from "../src/custody-seat.js";
import {
  generateOrLoadPersonaGroupRoot, landPersonaRoot, listPersonaRosterLines, loadPersonaGroupRootSeed, orphanPersonaRootKey,
} from "../src/node-vessel-identity.js";
import { faceRowNames, handleRowPath } from "./face-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const pairOf = async (fill: number) => {
  const seed = Uint8Array.from({ length: 32 }, (_, i) => (i * 5 + fill) & 0xff);
  return { signingKey: hex(seed), verifyingKey: hex(await ed.getPublicKeyAsync(seed)) };
};
const bytesOf = (): Record<string, string> =>
  Object.fromEntries(faceRowNames().filter((n) => /persona-(group-root|roster)/.test(n)).map((n) => [n, readFileSync(handleRowPath(n)).toString("hex")]));
const readingOf = async (p: Promise<unknown>): Promise<string> => {
  const e = await p.then(() => null, (err: unknown) => err);
  return e === null ? "LANDED" : e instanceof CustodyRowUnavailable ? e.reading : `threw: ${(e as Error).message.slice(0, 60)}`;
};

let seat: SeatedScratchCustody;
beforeEach(async () => { seat = await seatScratchCustody("land-root"); });
afterEach(async () => { await seat.drop(); });

describe("a restore lands a carried root", () => {
  test("L1 — the root lands with its roster line, opens to its own seed, and the same root again changes nothing", async () => {
    const carried = await pairOf(3);
    await landPersonaRoot(2, carried);
    expect(await listPersonaRosterLines()).toEqual([{ handleIndex: 2, verifyingKey: carried.verifyingKey }]);
    expect(hex(await loadPersonaGroupRootSeed(2))).toBe(carried.signingKey);
    const before = bytesOf();
    await landPersonaRoot(2, carried);
    expect(bytesOf()).toEqual(before);
  });

  test("L2 — another key standing at the index refuses `names-another-key`, and its bytes stay", async () => {
    const minted = await generateOrLoadPersonaGroupRoot(0);
    const before = bytesOf();
    expect(await readingOf(landPersonaRoot(0, await pairOf(3)))).toBe("names-another-key");
    expect(bytesOf()).toEqual(before);
    expect((await listPersonaRosterLines())[0]!.verifyingKey).toBe(minted.verifyingKey);
  });

  test("L3 — a keypair whose public half its seed does not derive refuses before any write", async () => {
    const a = await pairOf(3), b = await pairOf(4);
    expect(await readingOf(landPersonaRoot(1, { signingKey: a.signingKey, verifyingKey: b.verifyingKey }))).toBe("malformed");
    expect(await readingOf(landPersonaRoot(1, { signingKey: "zz", verifyingKey: a.verifyingKey }))).toBe("malformed");
    expect(await listPersonaRosterLines()).toEqual([]);
    expect(bytesOf()).toEqual({});
  });

  test("L4 — an orphan root row reads its key; a held index and an empty index read none", async () => {
    const carried = await pairOf(3);
    await landPersonaRoot(1, carried);
    expect(await orphanPersonaRootKey(1), "a root the roster names counts as held, never as an orphan").toBeNull();
    expect(await orphanPersonaRootKey(4)).toBeNull();
    // The roster row leaves: the root row stands with no line, an orphan.
    const roster = ".persona-roster-h1.json";
    expect(await removeCustodyRow("identity", roster)).toBe(true);
    expect(await orphanPersonaRootKey(1)).toBe(carried.verifyingKey);
    // Another key refuses over the orphan, and the refusal adopts nothing: no roster line appears.
    const before = bytesOf();
    expect(await readingOf(landPersonaRoot(1, await pairOf(9)))).toBe("names-another-key");
    expect(await listPersonaRosterLines()).toEqual([]);
    expect(bytesOf()).toEqual(before);
    // The same root lands over its own orphan and takes its roster line.
    await landPersonaRoot(1, carried);
    expect(await listPersonaRosterLines()).toEqual([{ handleIndex: 1, verifyingKey: carried.verifyingKey }]);
  });
});
