/**
 * The scratch custody opens what the scratch route founded, one route per call: the node tree by the scratch route,
 * the faces by the face route the harness seated (the scratch route unless a harness founds faces under its own).
 * A face opens by its own route, never a bag of every route (`custody-holder`: "a face opens by its own unlock").
 * `openTreeKey` derives one scrypt per passphrase offered, so counting the passphrases handed to the holder counts
 * the derivations without a clock.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import type { CustodyHomes } from "../src/custody-io.js";
import { SCRATCH_PASSPHRASE, ScratchCustodyRefused, openScratch, seatScratchFaceRoute } from "./support/scratch-custody-setup.js";

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

describe("the scratch custody's open", () => {
  it("RED: a tree the scratch route opens costs TWO derivations in all: the node tree and the faces, each by the scratch route alone", async () => {
    await foundUnder(SCRATCH_PASSPHRASE);
    const seen: string[][] = [];
    await openScratch(counting(seen));
    expect(seen.length, "an unlock and an unlockFaces").toBe(2);
    expect(seen, "each call offers one route, the scratch route").toEqual([[SCRATCH_PASSPHRASE], [SCRATCH_PASSPHRASE]]);
  });

  it("RED: a harness that founds its faces under its own route seats it, and the faces call offers that route alone", async () => {
    await foundUnder(SCRATCH_PASSPHRASE);
    const seen: string[][] = [];
    seatScratchFaceRoute("a-harness-face-route");
    try { await openScratch(counting(seen)); } finally { seatScratchFaceRoute(SCRATCH_PASSPHRASE); }
    expect(seen).toEqual([[SCRATCH_PASSPHRASE], ["a-harness-face-route"]]);
  });

  it("CONTROL: a tree founded under the scratch route opens", async () => {
    await foundUnder(SCRATCH_PASSPHRASE);
    await expect(openScratch(counting([]))).resolves.toBeUndefined();
  });

  it("RED: a tree founded under another route refuses by name; no staged fallback opens it", async () => {
    await foundUnder("test-founding-passphrase");
    const seen: string[][] = [];
    await expect(openScratch(counting(seen))).rejects.toBeInstanceOf(ScratchCustodyRefused);
    expect(seen).toEqual([[SCRATCH_PASSPHRASE]]);
  });
});
