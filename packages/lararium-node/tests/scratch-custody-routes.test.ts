/**
 * The scratch custody opens a standing tree by trying its own route ALONE, and the staged route only when the
 * scratch route refuses. `openTreeKey` derives one scrypt per passphrase offered per passphrase pin, so a list of
 * two routes costs two derivations on every open; counting the passphrases handed to the holder counts the
 * derivations without a clock.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import type { CustodyHomes } from "../src/custody-io.js";
import { SCRATCH_PASSPHRASE, openScratch } from "./support/scratch-custody-setup.js";

const STAGED = "test-founding-passphrase";
let dir: string;
let homes: CustodyHomes;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lares-routes-"));
  homes = { identity: join(dir, "identity"), storage: join(dir, "storage"), seal: join(dir, "seal") };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** A real holder whose unlock calls hand their passphrase lists to `seen`. */
function counting(seen: string[][]): CustodyHolder {
  const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  const note = (cs: readonly { kind: string; passphrase?: string }[]): void => {
    seen.push(cs.flatMap((c) => (c.kind === "passphrase" ? [c.passphrase!] : [])));
  };
  return new Proxy(holder, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r) as unknown;
      if ((k === "unlock" || k === "unlockFaces") && typeof v === "function") {
        return (cs: Parameters<CustodyHolder["unlock"]>[0]) => { note(cs as never); return (v as (c: unknown) => unknown).call(t, cs); };
      }
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
    },
  });
}
async function foundUnder(passphrase: string): Promise<void> {
  await foundCustody({ io: new FsCustodyIo(homes), homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase }] }] });
}
const derivations = (seen: string[][]): number => seen.reduce((n, list) => n + list.length, 0);

describe("the scratch custody's open", () => {
  it("RED: a tree the scratch route opens costs ONE derivation per unlock, never two", async () => {
    await foundUnder(SCRATCH_PASSPHRASE);
    const seen: string[][] = [];
    await openScratch(counting(seen));
    expect(seen.length, "an unlock and an unlockFaces").toBe(2);
    expect(derivations(seen), "one passphrase offered per call").toBe(2);
    expect(seen.every((list) => list.length === 1 && list[0] === SCRATCH_PASSPHRASE)).toBe(true);
  });

  it("CONTROL: a tree founded under the staged route still opens, and the staged route reaches the holder", async () => {
    await foundUnder(STAGED);
    const seen: string[][] = [];
    const holder = counting(seen);
    await openScratch(holder);
    expect(seen.flat()).toContain(STAGED);
    const again = await holder.unlock([{ kind: "passphrase", passphrase: STAGED }]);
    expect(["opens", "already-unlocked"]).toContain(again.reading);
  });
});
