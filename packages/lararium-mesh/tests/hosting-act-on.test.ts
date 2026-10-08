/**
 * hosting-act-on.test.ts — a walker reads its hearth's act for an epoch off the hosting doc, waiting for the doc
 * to sync when a fresh grant names an epoch whose act has not landed yet.
 *
 * Proven, over an in-memory handle:
 *   · RED: an act that lands AFTER the read began is returned once the doc changes;
 *   · CONTROL: an act already on the doc returns at once; an epoch whose act never lands returns null at the bound;
 *   · an act whose signature does not hold under its own leaf is never returned, though its CID matches.
 */
import { describe, test, expect } from "vitest";
import { mintHostingAct, writeHostingAct, hostingActCid } from "../src/hosting.js";
import { hostingActOn, type HostingDocHandle } from "../src/walk-client.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";

const AID = "epoch0-" + "a".repeat(64);
const LEAF = new Uint8Array(32).fill(61);

function handle(doc: LarDoc): HostingDocHandle & { land(change: (d: LarDoc) => void): void } {
  const listeners = new Set<() => void>();
  return {
    doc: () => doc,
    on: (_e, l) => { listeners.add(l); },
    off: (_e, l) => { listeners.delete(l); },
    land(change) { change(doc); for (const l of [...listeners]) l(); },
  };
}

describe("reading the hearth's act off its hosting doc", () => {
  test("RED: an act that lands after the read began is returned once the doc changes", async () => {
    const e = await mintHostingAct({ leafSeed: LEAF, nexusAid: AID, prev: null, cap: 3 });
    const h = handle(emptyLarDoc());
    const reading = hostingActOn(h, e.cid, 5_000);
    setTimeout(() => h.land((d) => writeHostingAct(d, e.act)), 30);
    expect(hostingActCid((await reading)!)).toBe(e.cid);
  });

  test("CONTROL: an act already on the doc returns at once; one that never lands returns null at the bound", async () => {
    const e = await mintHostingAct({ leafSeed: LEAF, nexusAid: AID, prev: null, cap: 3 });
    const doc = emptyLarDoc();
    writeHostingAct(doc, e.act);
    expect(hostingActCid((await hostingActOn(handle(doc), e.cid, 0))!)).toBe(e.cid);
    expect(await hostingActOn(handle(emptyLarDoc()), e.cid, 50)).toBeNull();
  });

  test("an act whose signature does not hold is never returned", async () => {
    const e = await mintHostingAct({ leafSeed: LEAF, nexusAid: AID, prev: null, cap: 3 });
    const forged = { ...e.act, sig: "00".repeat(64) };
    const doc = emptyLarDoc();
    writeHostingAct(doc, forged);
    expect(await hostingActOn(handle(doc), hostingActCid(forged), 50)).toBeNull();
  });
});
