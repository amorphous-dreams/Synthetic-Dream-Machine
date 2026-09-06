/**
 * dyad-read-path — a vessel enumerates its OWN relationships, from the slots the ceremony minted.
 *
 * THE SLOT IS THE ONLY READ SOURCE (Stage 0 ruling + the alpha collapse, 2026-09-06). A ceremony
 * mints a dyad slot wherever a face meets a device, so a doc holding a bare delegation edge and no
 * slot presents NO relationship — the edge carries the Binding Gate's authority, never a dyad. The
 * pre-ruling (device × root) fallback died with the back-compass: alpha owes none.
 *
 * The BINDING stays null until a group root signs one, and a dyad carrying `binding: null` joins no
 * fleet — `fleetOfGroup` enforces that rather than merely documenting it.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-circle
 */

import { describe, expect, test } from "vitest";
import { DYAD_ID_DOMAIN } from "../src/domains.js";
import {
  dyadId, dyadsOnVessel, fleetOfGroup, dyadsFromDoc, writeDyad, dyadSlotKey,
  type DyadRecord, type DelegationEdge,
} from "../src/dyad.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { DeviceDelegationTiddler } from "../src/device-delegation.js";

const ROOT   = "0x" + "aa".repeat(32);
const DEVICE = "0x" + "bb".repeat(32);
const OTHER  = "0x" + "cc".repeat(32);
const VEIL_1 = "0x" + "dd".repeat(32);
const VEIL_2 = "0x" + "ee".repeat(32);

const edge = (deviceDid: string, rootDid = ROOT): DeviceDelegationTiddler => ({
  kind: "device-delegation",
  personaRootDid: rootDid as never,
  deviceDid: deviceDid as never,
  deviceVerifyingKey: deviceDid.slice(2),
  hearthTrueName: "",
  issuedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
} as DeviceDelegationTiddler);

/** The ruled record shape: an EXPLICIT ref (place × derived face), the edge as carriage. */
const rec = (vessel: string, veil: string, binding: DelegationEdge | null = null): DyadRecord => {
  const ref = { vesselDid: vessel, veilDid: veil };
  return { kind: DYAD_ID_DOMAIN, dyadId: dyadId(ref), ref, edge: edge(vessel), binding };
};

describe("the read path — a vessel sees the relationships its slots carry", () => {
  test("★ a minted slot reads back whole, and its ref is the authority for the veil ★", () => {
    const d = rec(DEVICE, VEIL_1);
    const doc = emptyLarDoc();
    writeDyad(doc, d);
    const back = dyadsFromDoc(doc);
    expect(back).toHaveLength(1);
    expect(back[0]!.ref.veilDid).toBe(VEIL_1);
    expect(back[0]!.ref.veilDid).not.toBe(ROOT);
    expect(back[0]!.dyadId).toBe(dyadId(d.ref));
    // The id content-addresses the ORDERED pair, so it never collides with the reverse relation.
    expect(dyadId({ vesselDid: DEVICE, veilDid: ROOT })).not.toBe(dyadId({ vesselDid: ROOT, veilDid: DEVICE }));
  });

  test("an unbound dyad joins NO fleet — absence of a binding is not membership in a default group", () => {
    const d = rec(DEVICE, VEIL_1);
    expect(d.binding).toBeNull();
    expect(fleetOfGroup([d], ROOT)).toEqual([]);
  });

  test("a vessel filters the dyads that name IT, and not another place", () => {
    const mine = rec(DEVICE, VEIL_1);
    const theirs = rec(OTHER, VEIL_2);
    expect(dyadsOnVessel([mine, theirs], DEVICE)).toEqual([mine]);
  });

  test("★ N dyads land in N slots and read back whole ★", () => {
    const doc: LarDoc = emptyLarDoc();
    const a = rec(DEVICE, VEIL_1);
    const b = rec(OTHER, VEIL_2);
    for (const d of [a, b]) writeDyad(doc, d);
    const back = dyadsFromDoc(doc);
    expect(back.map((d) => d.dyadId).sort()).toEqual([a.dyadId, b.dyadId].sort());
    expect(dyadSlotKey(a.dyadId)).not.toBe(dyadSlotKey(b.dyadId));
  });

  test("★ a slot WITHOUT a ref drops — alpha carries no fallback reading ★", () => {
    const doc = emptyLarDoc();
    const good = rec(DEVICE, VEIL_1);
    writeDyad(doc, good);
    // a pre-collapse slot shape: kind + edge, no ref — the dead (device × root) reading's carrier
    const key = dyadSlotKey("a".repeat(64));
    doc.tiddlers[key] = {
      id: key, tiddler: { text: JSON.stringify({ kind: DYAD_ID_DOMAIN, edge: edge(DEVICE) }) },
    } as never;
    expect(dyadsFromDoc(doc)).toHaveLength(1);
  });

  test("★ a slot whose ref rides ANOTHER device drops — the edge fences the relationship ★", () => {
    const doc = emptyLarDoc();
    const forged: DyadRecord = { ...rec(OTHER, VEIL_1), edge: edge(DEVICE) };
    writeDyad(doc, forged);
    expect(dyadsFromDoc(doc)).toEqual([]);
  });
});
