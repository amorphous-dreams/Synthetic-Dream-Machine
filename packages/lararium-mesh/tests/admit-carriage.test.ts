/**
 * admit-carriage vectors — an admit SIGNS the hearth's gate pin and canon list it carries
 * (face-proof#/the-gate-exchange, step 5). Mutating either carried value fails the one door that hands them
 * out (`verifySignedAdmitBundle`), at two faces and two Nexuses; every reader of the entry keeps the field, so
 * the act's CID and its quorum survive the board, the partial and the presented-admit shape.
 */
import { describe, expect, test } from "vitest";
import {
  carriageEntryActCid, carriageEntryBytes, carriageEntryCounts, readAdmitCarriage, type AdmitCarriage, type CarriageEntry,
} from "../src/carriage-registry.js";
import { carriageEntriesFromBoard, writeCarriageEntry } from "../src/carriage-board.js";
import { nexusActPartial, readNexusActPartial } from "../src/nexus-partial.js";
import { isPresentedAdmit } from "../src/auth-wire.js";
import { heldNexusRoot, readAdmitAtHeldRoot, verifySignedAdmitBundle, type HeldNexusRoot } from "../src/held-nexus-root.js";
import { makeMultiSigQuorumVerifier } from "../src/kapae-antigen.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";
import { carriageAct, kahuRoster } from "./fixtures/carriage.js";
import * as mesh from "../src/index.js";

const PIN_A = "a1".repeat(32);
const PIN_B = "b2".repeat(32);
const CANON_A: AdmitCarriage["canon"] = { "bags/lares": "automerge:lares-a", "bags/lararium": "automerge:lararium-a" };
const carriageOf = (gatePin: string, canon: AdmitCarriage["canon"] = CANON_A): AdmitCarriage => ({ gatePin, canon });

async function rootOf(charter: SeatedCharter): Promise<HeldNexusRoot> {
  const doc = charter.doc({ labels: charter.keys.map((_, i) => `seat-${i}`) });
  const root = heldNexusRoot({ nexus: charter.aid, charter: doc, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in root) throw new Error(`fixture root absent: ${root.absent}`);
  return root;
}
const admitAt = (charter: SeatedCharter, face: Uint8Array, carriage?: AdmitCarriage) =>
  carriageAct(face, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid, ...(carriage ? { carriage } : {}) });
const bundleOf = (charter: SeatedCharter, admit: CarriageEntry, gatePubKey = admit.carriage?.gatePin ?? PIN_A) =>
  ({ aid: charter.aid, gatePubKey, admit, lineage: [] as const });

describe("an admit's carried pin and canon read only as the quorum signed them", () => {
  test("the shape reader takes exactly a 64-hex pin and a small map of canon titles to urls", () => {
    expect(readAdmitCarriage(carriageOf(PIN_A))).toEqual(carriageOf(PIN_A));
    expect(readAdmitCarriage(carriageOf(PIN_A, {}))).toEqual(carriageOf(PIN_A, {}));
    for (const bad of [null, {}, { gatePin: PIN_A }, { canon: CANON_A }, carriageOf("A1".repeat(32)), carriageOf("a1".repeat(31)),
      { ...carriageOf(PIN_A), extra: 1 }, carriageOf(PIN_A, { "": "automerge:x" }), carriageOf(PIN_A, { "bags/lares": "" }),
      carriageOf(PIN_A, { "bags/lares": 7 } as never), carriageOf(PIN_A, ["automerge:x"] as never)]) {
      expect(readAdmitCarriage(bad)).toBeNull();
    }
  });

  test("the act image binds both fields, and an admit that carries none keeps the image it always had", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 901 });
    const bare = await admitAt(charter, new Uint8Array(32).fill(61));
    expect(new TextDecoder().decode(carriageEntryBytes(bare))).not.toContain(`"carriage":`);
    expect(new TextDecoder().decode(carriageEntryBytes({ ...bare, carriage: carriageOf(PIN_A) }))).toContain(`"carriage":`);
    const pinned = { ...bare, carriage: carriageOf(PIN_A) };
    expect(carriageEntryActCid(pinned)).not.toBe(carriageEntryActCid(bare));
    expect(carriageEntryActCid({ ...pinned, carriage: carriageOf(PIN_B) })).not.toBe(carriageEntryActCid(pinned));
    expect(carriageEntryActCid({ ...pinned, carriage: carriageOf(PIN_A, { "bags/lares": "automerge:lares-b" }) })).not.toBe(carriageEntryActCid(pinned));
    // Key order never moves the image: the canon map reads canonically.
    expect(carriageEntryActCid({ ...pinned, carriage: carriageOf(PIN_A, { "bags/lararium": CANON_A["bags/lararium"]!, "bags/lares": CANON_A["bags/lares"]! }) }))
      .toBe(carriageEntryActCid(pinned));
  });

  test("two faces at two Nexuses: each signed bundle hands out its own pin and canon, and no mutation passes", async () => {
    const nexuses = [await seatedCharter({ seats: 2, threshold: 2, seed: 911 }), await seatedCharter({ seats: 3, threshold: 2, seed: 912 })];
    const faces = [new Uint8Array(32).fill(71), new Uint8Array(32).fill(72)];
    const roots = await Promise.all(nexuses.map(rootOf));
    for (const [n, charter] of nexuses.entries()) {
      for (const [f, face] of faces.entries()) {
        const carriage = carriageOf(n === 0 ? PIN_A : PIN_B, { "bags/lares": `automerge:lares-${n}-${f}` });
        const admit = await admitAt(charter, face, carriage);
        const held = await verifySignedAdmitBundle(bundleOf(charter, admit), roots[n]);
        expect(held).toMatchObject({ carriage, reading: { nexus: charter.aid, head: admit.nym } });
        // CONTROL: the held-root door itself names the same carriage.
        expect(await readAdmitAtHeldRoot({ admit, lineage: [] }, roots[n])).toMatchObject({ carriage });

        const otherPin = { ...admit, carriage: { ...carriage, gatePin: PIN_B === carriage.gatePin ? PIN_A : PIN_B } };
        expect(await verifySignedAdmitBundle(bundleOf(charter, otherPin), roots[n])).toMatchObject({ refusal: "admit-not-held" });
        const otherCanon = { ...admit, carriage: { ...carriage, canon: { "bags/lares": "automerge:swapped" } } };
        expect(await verifySignedAdmitBundle(bundleOf(charter, otherCanon), roots[n])).toMatchObject({ refusal: "admit-not-held" });
        const stripped: CarriageEntry = { ...admit };
        delete (stripped as { carriage?: unknown }).carriage;
        expect(await verifySignedAdmitBundle(bundleOf(charter, stripped, carriage.gatePin), roots[n])).toMatchObject({ refusal: "admit-not-held" });
        expect(await verifySignedAdmitBundle(bundleOf(charter, admit, "cc".repeat(32)), roots[n])).toEqual({ refusal: "pin-differs" });
        expect(await verifySignedAdmitBundle(bundleOf(charter, admit), roots[1 - n])).toEqual({ refusal: "bundle-other-nexus" });
        expect(await verifySignedAdmitBundle(bundleOf(charter, admit), null)).toEqual({ refusal: "no-held-root" });
      }
    }
    // A face's carriage lifted onto the other face's admit fails that admit's quorum.
    const a0 = await admitAt(nexuses[0]!, faces[0]!, carriageOf(PIN_A));
    const a1 = await admitAt(nexuses[0]!, faces[1]!, carriageOf(PIN_A, { "bags/lares": "automerge:face-1" }));
    expect(await verifySignedAdmitBundle(bundleOf(nexuses[0]!, { ...a1, carriage: a0.carriage! }), roots[0])).toMatchObject({ refusal: "admit-not-held" });
  });

  test("a held admit that signed no pin hands out none, and a malformed bundle reads as none", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 921 });
    const root = await rootOf(charter);
    const bare = await admitAt(charter, new Uint8Array(32).fill(81));
    expect(await verifySignedAdmitBundle(bundleOf(charter, bare), root)).toEqual({ refusal: "admit-carries-no-pin" });
    for (const bad of [null, {}, { ...bundleOf(charter, bare), gatePubKey: "zz" }, { ...bundleOf(charter, bare), aid: 7 }]) {
      expect(await verifySignedAdmitBundle(bad, root)).toEqual({ refusal: "bundle-malformed" });
    }
  });

  test("a carriage counts on an admit alone, and only well formed", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 931 });
    const roster = await kahuRoster(charter.seeds, 2, charter.head.epochCid);
    const face = new Uint8Array(32).fill(91);
    expect(await carriageEntryCounts(await admitAt(charter, face, carriageOf(PIN_A)), roster)).toBe(true);
    const revoke = await carriageAct(face, "revoke", { kahu: charter.seeds, epoch: charter.head.epochCid, carriage: carriageOf(PIN_A) });
    expect(await carriageEntryCounts(revoke, roster)).toBe(false);
    const torn = await carriageAct(face, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid, carriage: { gatePin: "nope", canon: {} } });
    expect(await carriageEntryCounts(torn, roster)).toBe(false);
  });

  test("the board, the partial and the presented-admit shape all keep the field, so the CID and quorum survive", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 941 });
    const roster = await kahuRoster(charter.seeds, 2, charter.head.epochCid);
    const admit = await admitAt(charter, new Uint8Array(32).fill(101), carriageOf(PIN_A));
    const doc = { tiddlers: {} } as Parameters<typeof writeCarriageEntry>[0];
    writeCarriageEntry(doc, admit);
    const [read] = carriageEntriesFromBoard(doc);
    expect(read?.carriage).toEqual(admit.carriage);
    expect(carriageEntryActCid(read!)).toBe(carriageEntryActCid(admit));
    expect(await carriageEntryCounts(read!, roster)).toBe(true);
    // A torn carriage on the board reads the whole entry closed, never a half entry.
    const tornDoc = { tiddlers: {} } as Parameters<typeof writeCarriageEntry>[0];
    writeCarriageEntry(tornDoc, { ...admit, carriage: { gatePin: "x", canon: {} } });
    expect(carriageEntriesFromBoard(tornDoc)).toEqual([]);

    const partial = nexusActPartial(charter.aid, { family: "admit", entry: admit });
    expect(partial.act.family === "admit" && partial.act.entry.carriage).toEqual(admit.carriage);
    expect(readNexusActPartial({ ...partial, act: { ...partial.act, entry: { ...admit, carriage: { gatePin: PIN_A } } } })).toBeNull();
    expect(isPresentedAdmit({ admit, lineage: [] })).toBe(true);
    expect(isPresentedAdmit({ admit: { ...admit, carriage: { gatePin: PIN_A } }, lineage: [] })).toBe(false);
  });

  test("the verifier stands in the barrel", () => {
    expect(Object.keys(mesh)).toContain("verifySignedAdmitBundle");
    expect(Object.keys(mesh)).toContain("readAdmitCarriage");
  });
});
