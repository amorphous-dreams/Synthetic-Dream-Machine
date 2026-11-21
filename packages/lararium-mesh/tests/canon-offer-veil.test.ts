/**
 * canon-offer-veil — an offer row rests on a board every face of the Nexus reads, so it names nothing that joins the
 * offering face to itself at another Nexus, or to the realms its PersonaGroup addresses.
 *
 *   V1  the board row of an offer carries no PersonaGroup and no atom key
 *   V2  one face offers under a different key at each Nexus, and under one key at one Nexus (the steward attributes a
 *       second offer there to the same offerer)
 *   V3  CONTROL: each offer still verifies under its own Nexus and refuses under another
 *   V4  a row that carries any field beyond the sealed five reads malformed (no identity rides beside the body)
 */
import { beforeAll, describe, expect, test } from "vitest";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { faceAtomKeyFromSeed } from "../src/face-atom.js";
import {
  CANON_OFFER_PREFIX, foldCanonOffers, nexusOfferSigner, offerCanonRecords, readCanonOffers, verifyCanonOffer,
  type CanonOfferBoard, type CanonOfferPorts, type OfferRecordReader,
} from "../src/canon-offer.js";
import type { LarTiddlerRecord } from "../src/tiddler-store.js";
import { seatedCharter } from "./charter-fixture.js";

const GROUP = "c1".repeat(32);
const ATOM_SEED = new Uint8Array(32).fill(41);
const T1 = "lar:///ha.ka.ba/lares/docs/pono/veiled-one";
const T2 = "lar:///ha.ka.ba/lares/docs/pono/veiled-two";

let NEXUS_A: string;
let NEXUS_B: string;
beforeAll(async () => {
  NEXUS_A = (await seatedCharter({ seats: 3, threshold: 1 })).aid;
  NEXUS_B = (await seatedCharter({ seats: 3, threshold: 1, seed: 2 })).aid;
  expect(NEXUS_B).not.toBe(NEXUS_A);
});

const rec = (title: string, text: string): LarTiddlerRecord => ({ tiddler: { title, text } as LarTiddlerRecord["tiddler"] });
function source(rows: Record<string, LarTiddlerRecord>): OfferRecordReader & { listVisible(): Promise<string[]> } {
  return { get: async (t) => rows[t] ?? null, listVisible: async () => Object.keys(rows) };
}
function board(): CanonOfferBoard {
  let doc: LarDoc = emptyLarDoc();
  return { doc: () => doc, change: (fn) => { const draft = structuredClone(doc); fn(draft); doc = draft; } };
}
const ports = (nexus: string, b: CanonOfferBoard): CanonOfferPorts => ({ nexus, board: b, canon: async () => ({ get: async () => null }) });

/** The lit face offers at one Nexus, as the daemon island's door does it: under its offer key at that Nexus, derived from its atom seed. */
async function offerAt(nexus: string, b: CanonOfferBoard, title: string) {
  return offerCanonRecords({ ...ports(nexus, b), source: source({ [title]: rec(title, "offered") }), signer: nexusOfferSigner(ATOM_SEED, nexus) }, { bag: "lares", titles: [title] });
}
const rowText = (b: CanonOfferBoard, cid: string): string => String((b.doc()!.tiddlers[`${CANON_OFFER_PREFIX}${cid}`] as { tiddler: { text: string } }).tiddler.text);

describe("the veil at the offer", () => {
  test("V1: an offer's board row carries no PersonaGroup and no atom key", async () => {
    const b = board();
    const out = await offerAt(NEXUS_A, b, T1);
    const row = rowText(b, out.offer.cid);
    const atom = faceAtomKeyFromSeed(ATOM_SEED, GROUP);
    expect(row.includes(GROUP), "the row names the offering face's PersonaGroup").toBe(false);
    expect(row.includes(atom.key), "the row names the offering face's atom key").toBe(false);
  });

  test("V2: one face offers under a different key at each Nexus, and under one key at one Nexus", async () => {
    const a = board(), b = board();
    const atA = await offerAt(NEXUS_A, a, T1);
    const atA2 = await offerAt(NEXUS_A, a, T2);
    const atB = await offerAt(NEXUS_B, b, T1);
    expect(atB.offer.body.offerer, "one key names the face at two Nexuses").not.toBe(atA.offer.body.offerer);
    expect(atA2.offer.body.offerer, "the steward attributes a second offer at one Nexus to the same offerer").toBe(atA.offer.body.offerer);
    const listed = await readCanonOffers(ports(NEXUS_A, a));
    expect(new Set(listed.offers.map((o) => o.offerer)).size).toBe(1);
    // Neither key reaches the atom: the offer key at a Nexus differs from the key the face signs everything else with.
    const atom = faceAtomKeyFromSeed(ATOM_SEED, GROUP);
    expect([atA.offer.body.offerer, atB.offer.body.offerer]).not.toContain(atom.key);
    // CONTROL: another face at the same Nexus reads as another offerer.
    expect(nexusOfferSigner(new Uint8Array(32).fill(42), NEXUS_A).key).not.toBe(atA.offer.body.offerer);
  });

  test("V3 CONTROL: each offer verifies under its own Nexus and refuses under another", async () => {
    const a = board();
    const out = await offerAt(NEXUS_A, a, T1);
    expect(verifyCanonOffer({ record: out.offer, keyedBy: out.offer.cid, nexus: NEXUS_A }).ok).toBe(true);
    expect(verifyCanonOffer({ record: out.offer, keyedBy: out.offer.cid, nexus: NEXUS_B })).toEqual({ ok: false, reason: "foreign-nexus" });
    expect(foldCanonOffers(a.doc(), NEXUS_A).offers).toHaveLength(1);
  });

  test("V4: a row whose body carries a field beyond the sealed five reads malformed", async () => {
    const a = board();
    const out = await offerAt(NEXUS_A, a, T1);
    const forged = { ...out.offer, body: { ...out.offer.body, face: GROUP } };
    expect(verifyCanonOffer({ record: forged, nexus: NEXUS_A })).toEqual({ ok: false, reason: "malformed-offer" });
  });
});
