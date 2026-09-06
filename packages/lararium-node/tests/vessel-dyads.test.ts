/**
 * vessel-dyads — the live read path: a vessel enumerates the relationships its SLOTS carry.
 *
 * ALPHA CARRIES NO BACK-COMPASS (operator, 2026-09-06): the ceremony mints a dyad slot wherever a
 * face meets a device, so the slot is the only read source. A doc holding a bare delegation edge
 * and no slot presents NO relationship — the edge carries the Binding Gate's authority, never a
 * dyad — and the boot read says that drift aloud instead of inventing a (device × root) reading.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-circle
 */
import { describe, expect, test } from "vitest";
import { emptyLarDoc, mutableLarRecord, DEVICE_DELEGATION_SELF_TIDDLER, writeDyad, dyadId,
         DYAD_ID_DOMAIN,
         type LarDoc, type DeviceDelegationTiddler, type DyadRecord, type DelegationEdge } from "@lararium/mesh";
import { vesselDyads } from "../src/vessel-dyads.js";

const ROOT   = "0x" + "aa".repeat(32);
const DEVICE = "0x" + "bb".repeat(32);
const VEIL_1 = "0x" + "dd".repeat(32);
const VEIL_2 = "0x" + "ee".repeat(32);

function wholeEdge(deviceDid: string): DeviceDelegationTiddler {
  return {
    kind: "device-delegation", personaRootDid: ROOT, deviceDid,
    deviceVerifyingKey: deviceDid.slice(2), hearthTrueName: "",
    issuedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z",
  } as unknown as DeviceDelegationTiddler;
}

/** The ruled record shape: an EXPLICIT ref (place × derived face), the edge as carriage. */
function rec(vessel: string, veil: string, binding: DelegationEdge | null = null): DyadRecord {
  const ref = { vesselDid: vessel, veilDid: veil };
  return { kind: DYAD_ID_DOMAIN, dyadId: dyadId(ref), ref, edge: wholeEdge(vessel), binding };
}

function docWithSelfEdge(): LarDoc {
  const doc = emptyLarDoc();
  doc.tiddlers[DEVICE_DELEGATION_SELF_TIDDLER] =
    mutableLarRecord(DEVICE_DELEGATION_SELF_TIDDLER, wholeEdge(DEVICE) as never, "vessel-dyads-test");
  return doc;
}

describe("vesselDyads — the vessel's own relationships, read from its slots", () => {
  test("★ a bare self-edge with NO slot reads ZERO dyads — unminted is unpresented ★", () => {
    // The pre-collapse fallback read (device × root) here; alpha owes it nothing. The boot path
    // warns on exactly this shape (a face beside zero slots) instead of fabricating a reading.
    expect(vesselDyads(docWithSelfEdge())).toEqual([]);
  });

  test("★ a minted slot reads back — the derived veil, never the root ★", () => {
    const doc = docWithSelfEdge();
    writeDyad(doc, rec(DEVICE, VEIL_1));
    const dyads = vesselDyads(doc);
    expect(dyads).toHaveLength(1);
    expect(dyads[0]!.ref.vesselDid).toBe(DEVICE);
    expect(dyads[0]!.ref.veilDid).toBe(VEIL_1);
    expect(dyads[0]!.ref.veilDid).not.toBe(ROOT);
    expect(dyads[0]!.binding).toBeNull();
  });

  /** THE FLOOR, and it must not read as a fault: a place holding no face holds no relationship. */
  test("a vessel at the waking floor reads zero dyads, and never throws", () => {
    expect(vesselDyads(emptyLarDoc())).toEqual([]);
    expect(vesselDyads(undefined)).toEqual([]);
  });

  test("N faces read as N slots — the count follows the vessel", () => {
    const doc = docWithSelfEdge();
    writeDyad(doc, rec(DEVICE, VEIL_1));
    writeDyad(doc, rec(DEVICE, VEIL_2));
    expect(vesselDyads(doc)).toHaveLength(2);
  });

  test("re-writing the SAME relationship stays one record — de-duped by dyadId", () => {
    const doc = docWithSelfEdge();
    writeDyad(doc, rec(DEVICE, VEIL_1));
    writeDyad(doc, rec(DEVICE, VEIL_1));
    expect(vesselDyads(doc)).toHaveLength(1);
  });
});
