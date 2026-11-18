/**
 * admit-carriage vectors — an admit's quorum signs a hiding commitment to the hearth's gate pin and canon list it
 * carries (face-proof#/the-gate-exchange, step 5), and the members board carries that commitment alone
 * (membership-doctrine#/the-operator-contract: the floor and nothing above it). Mutating the pin, the canon list or
 * the salt fails the one door that hands them out (`verifySignedAdmitBundle`), at two faces and two Nexuses; every
 * reader of the entry keeps the commitment, so the act's CID and its quorum survive the board, the partial and the
 * presented-admit shape.
 */
import { describe, expect, test } from "vitest";
import {
  admitCarriageCommit, carriageEntryActCid, carriageEntryBytes, carriageEntryCounts, openAdmitCarriage, readAdmitCarriage, readAdmitOpening,
  type AdmitCarriage, type AdmitOpening, type CarriageEntry,
} from "../src/carriage-registry.js";
import { carriageEntriesFromBoard, writeCarriageEntry } from "../src/carriage-board.js";
import { nexusActPartial, readNexusActPartial } from "../src/nexus-partial.js";
import { isPresentedAdmit } from "../src/leaf-presentation.js";
import { heldNexusRoot, readAdmitAtHeldRoot, verifySignedAdmitBundle, type HeldNexusRoot } from "../src/held-nexus-root.js";
import { makeMultiSigQuorumVerifier } from "../src/kapae-antigen.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";
import { carriageAct, kahuRoster } from "./fixtures/carriage.js";
import { sovereignPinAt } from "./fixtures/sovereign-pin.js";
import * as mesh from "../src/index.js";
import type { GateBundlePin } from "../src/index.js";

const PIN_A = sovereignPinAt("nexus-shape", 1);
const PIN_B = sovereignPinAt("nexus-shape", 2);
const CANON_A: AdmitCarriage["canon"] = { "bags/lares": "automerge:lares-a", "bags/lararium": "automerge:lararium-a" };
const carriageOf = (gatePin: GateBundlePin, canon: AdmitCarriage["canon"] = CANON_A): AdmitCarriage => ({ gatePin, canon });

async function rootOf(charter: SeatedCharter): Promise<HeldNexusRoot> {
  const doc = charter.doc({ labels: charter.keys.map((_, i) => `seat-${i}`) });
  const root = heldNexusRoot({ nexus: charter.aid, charter: doc, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in root) throw new Error(`fixture root absent: ${root.absent}`);
  return root;
}
const admitAt = (charter: SeatedCharter, face: Uint8Array, opening?: AdmitOpening) =>
  carriageAct(face, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid, ...(opening ? { carriageCommit: admitCarriageCommit(opening) } : {}) });
const bundleOf = (charter: SeatedCharter, admit: CarriageEntry, opening?: AdmitOpening, gatePubKey = opening?.carriage.gatePin.signingKey ?? PIN_A.signingKey) =>
  ({ aid: charter.aid, gatePubKey, admit, lineage: [] as const, ...(opening ? { opening } : {}) });

describe("an admit's carried pin and canon read only as the quorum committed to them", () => {
  test("the shape readers take exactly a full sovereign sync pin with a small canon map, and a 64-hex salt beside it", () => {
    expect(readAdmitCarriage(carriageOf(PIN_A))).toEqual(carriageOf(PIN_A));
    expect(readAdmitCarriage(carriageOf(PIN_A, {}))).toEqual(carriageOf(PIN_A, {}));
    for (const bad of [null, {}, { gatePin: PIN_A }, { canon: CANON_A }, carriageOf("a1".repeat(32) as never), carriageOf({ ...PIN_A, signingKey: "A1".repeat(32) }),
      carriageOf({ ...PIN_A, tier: "floor" }), carriageOf({ ...PIN_A, route: "/flow" }), carriageOf({ ...PIN_A, extra: 1 } as never),
      { ...carriageOf(PIN_A), extra: 1 }, carriageOf(PIN_A, { "": "automerge:x" }), carriageOf(PIN_A, { "bags/lares": "" }),
      carriageOf(PIN_A, { "bags/lares": 7 } as never), carriageOf(PIN_A, ["automerge:x"] as never)]) {
      expect(readAdmitCarriage(bad)).toBeNull();
    }
    const opening = openAdmitCarriage(carriageOf(PIN_A));
    expect(readAdmitOpening(opening)).toEqual(opening);
    for (const bad of [{ carriage: carriageOf(PIN_A) }, { ...opening, salt: "ab" }, { ...opening, extra: 1 }, { ...opening, carriage: { gatePin: PIN_A } }]) {
      expect(readAdmitOpening(bad)).toBeNull();
    }
  });

  test("every opening draws a fresh salt, so one carriage commits to unlinkable values", () => {
    const [one, two] = [openAdmitCarriage(carriageOf(PIN_A)), openAdmitCarriage(carriageOf(PIN_A))];
    expect(one.salt).not.toBe(two.salt);
    expect(admitCarriageCommit(one)).not.toBe(admitCarriageCommit(two));
    expect(admitCarriageCommit(one)).toBe(admitCarriageCommit({ ...one }));
  });

  test("the act image binds the commitment, and an admit that carries none keeps the image it always had", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 901 });
    const bare = await admitAt(charter, new Uint8Array(32).fill(61));
    expect(new TextDecoder().decode(carriageEntryBytes(bare))).not.toContain(`"carriageCommit":`);
    const opening = openAdmitCarriage(carriageOf(PIN_A));
    const committed = { ...bare, carriageCommit: admitCarriageCommit(opening) };
    expect(new TextDecoder().decode(carriageEntryBytes(committed))).toContain(`"carriageCommit":`);
    expect(carriageEntryActCid(committed)).not.toBe(carriageEntryActCid(bare));
    for (const moved of [{ ...opening, carriage: carriageOf(PIN_B) }, { ...opening, carriage: carriageOf(PIN_A, { "bags/lares": "automerge:lares-b" }) },
      { ...opening, salt: "cd".repeat(32) }]) {
      expect(admitCarriageCommit(moved)).not.toBe(committed.carriageCommit);
    }
    // Key order never moves the commitment: the canon map reads canonically.
    const reordered = { ...opening, carriage: carriageOf(PIN_A, { "bags/lararium": CANON_A["bags/lararium"]!, "bags/lares": CANON_A["bags/lares"]! }) };
    expect(admitCarriageCommit(reordered)).toBe(committed.carriageCommit);
  });

  test("two faces at two Nexuses: each signed bundle hands out its own pin and canon, and no mutation passes", async () => {
    const nexuses = [await seatedCharter({ seats: 2, threshold: 2, seed: 911 }), await seatedCharter({ seats: 3, threshold: 2, seed: 912 })];
    const faces = [new Uint8Array(32).fill(71), new Uint8Array(32).fill(72)];
    const roots = await Promise.all(nexuses.map(rootOf));
    for (const [n, charter] of nexuses.entries()) {
      for (const [f, face] of faces.entries()) {
        const opening = openAdmitCarriage(carriageOf(sovereignPinAt(charter.aid, 1 + n), { "bags/lares": `automerge:lares-${n}-${f}` }));
        const admit = await admitAt(charter, face, opening);
        const held = await verifySignedAdmitBundle(bundleOf(charter, admit, opening), roots[n]);
        expect(held).toMatchObject({ carriage: opening.carriage, reading: { nexus: charter.aid, head: admit.nym } });
        // CONTROL: the held-root door itself names the same commitment.
        expect(await readAdmitAtHeldRoot({ admit, lineage: [] }, roots[n])).toMatchObject({ carriageCommit: admitCarriageCommit(opening) });

        const otherPin = { ...opening, carriage: { ...opening.carriage, gatePin: sovereignPinAt(charter.aid, 77) } };
        expect(await verifySignedAdmitBundle(bundleOf(charter, admit, otherPin), roots[n])).toEqual({ refusal: "opening-differs" });
        const otherCanon = { ...opening, carriage: { ...opening.carriage, canon: { "bags/lares": "automerge:swapped" } } };
        expect(await verifySignedAdmitBundle(bundleOf(charter, admit, otherCanon), roots[n])).toEqual({ refusal: "opening-differs" });
        expect(await verifySignedAdmitBundle(bundleOf(charter, admit, { ...opening, salt: "ef".repeat(32) }), roots[n])).toEqual({ refusal: "opening-differs" });
        // A commitment moved inside the admit fails its quorum.
        const recommitted = { ...admit, carriageCommit: admitCarriageCommit(otherPin) };
        expect(await verifySignedAdmitBundle(bundleOf(charter, recommitted, otherPin), roots[n])).toMatchObject({ refusal: "admit-not-held" });
        const stripped: CarriageEntry = { ...admit };
        delete (stripped as { carriageCommit?: unknown }).carriageCommit;
        expect(await verifySignedAdmitBundle(bundleOf(charter, stripped, opening), roots[n])).toMatchObject({ refusal: "admit-not-held" });
        expect(await verifySignedAdmitBundle(bundleOf(charter, admit, opening, "cc".repeat(32)), roots[n])).toEqual({ refusal: "pin-differs" });
        expect(await verifySignedAdmitBundle(bundleOf(charter, admit, opening), roots[1 - n])).toEqual({ refusal: "bundle-other-nexus" });
        // A pin the quorum committed to, standing at ANOTHER Nexus, hands out nothing: the admit names the Nexus it stands at.
        const strayed = openAdmitCarriage(carriageOf(sovereignPinAt(nexuses[1 - n]!.aid, 1), { "bags/lares": `automerge:stray-${n}-${f}` }));
        const strayedAdmit = await admitAt(charter, face, strayed);
        expect(await verifySignedAdmitBundle(bundleOf(charter, strayedAdmit, strayed), roots[n])).toEqual({ refusal: "pin-other-nexus" });
        expect(await verifySignedAdmitBundle(bundleOf(charter, admit, opening), null)).toEqual({ refusal: "no-held-root" });
      }
    }
    // A face's opening lifted onto the other face's admit fails that admit's commitment.
    const o0 = openAdmitCarriage(carriageOf(PIN_A)), o1 = openAdmitCarriage(carriageOf(PIN_A, { "bags/lares": "automerge:face-1" }));
    const a1 = await admitAt(nexuses[0]!, faces[1]!, o1);
    expect(await verifySignedAdmitBundle(bundleOf(nexuses[0]!, a1, o0), roots[0])).toEqual({ refusal: "opening-differs" });
  });

  test("a held admit that committed to nothing hands out nothing, and a malformed bundle reads as none", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 921 });
    const root = await rootOf(charter);
    const bare = await admitAt(charter, new Uint8Array(32).fill(81));
    const opening = openAdmitCarriage(carriageOf(PIN_A));
    expect(await verifySignedAdmitBundle(bundleOf(charter, bare, opening), root)).toEqual({ refusal: "admit-carries-no-pin" });
    const committed = await admitAt(charter, new Uint8Array(32).fill(82), opening);
    expect(await verifySignedAdmitBundle(bundleOf(charter, committed), root)).toEqual({ refusal: "admit-carries-no-pin" });
    for (const bad of [null, {}, { ...bundleOf(charter, bare), gatePubKey: "zz" }, { ...bundleOf(charter, bare), aid: 7 },
      { ...bundleOf(charter, committed, opening), opening: { carriage: opening.carriage } }]) {
      expect(await verifySignedAdmitBundle(bad, root)).toEqual({ refusal: "bundle-malformed" });
    }
  });

  test("a commitment counts on an admit alone, and only well formed", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 931 });
    const roster = await kahuRoster(charter.seeds, 2, charter.head.epochCid);
    const face = new Uint8Array(32).fill(91);
    const commit = admitCarriageCommit(openAdmitCarriage(carriageOf(PIN_A)));
    expect(await carriageEntryCounts(await carriageAct(face, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid, carriageCommit: commit }), roster)).toBe(true);
    const revoke = await carriageAct(face, "revoke", { kahu: charter.seeds, epoch: charter.head.epochCid, carriageCommit: commit });
    expect(await carriageEntryCounts(revoke, roster)).toBe(false);
    const torn = await carriageAct(face, "admit", { kahu: charter.seeds, epoch: charter.head.epochCid, carriageCommit: "nope" });
    expect(await carriageEntryCounts(torn, roster)).toBe(false);
  });

  test("THE FLOOR: the board carries the commitment and no pin, canon url or salt, and the CID and quorum survive", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 941 });
    const roster = await kahuRoster(charter.seeds, 2, charter.head.epochCid);
    const opening = openAdmitCarriage(carriageOf(PIN_A));
    const admit = await admitAt(charter, new Uint8Array(32).fill(101), opening);
    const doc = { tiddlers: {} } as Parameters<typeof writeCarriageEntry>[0];
    writeCarriageEntry(doc, admit);
    const written = JSON.stringify(doc);
    expect(written).toContain(admit.carriageCommit!);                                    // CONTROL: the board holds the entry
    for (const hidden of [PIN_A.signingKey, PIN_A.transportKey, ...Object.values(CANON_A), opening.salt]) expect(written).not.toContain(hidden);
    const [read] = carriageEntriesFromBoard(doc);
    expect(read?.carriageCommit).toBe(admit.carriageCommit);
    expect(carriageEntryActCid(read!)).toBe(carriageEntryActCid(admit));
    expect(await carriageEntryCounts(read!, roster)).toBe(true);
    // A torn commitment on the board reads the whole entry closed, never a half entry.
    const tornDoc = { tiddlers: {} } as Parameters<typeof writeCarriageEntry>[0];
    writeCarriageEntry(tornDoc, { ...admit, carriageCommit: "x" });
    expect(carriageEntriesFromBoard(tornDoc)).toEqual([]);

    expect(isPresentedAdmit({ admit, lineage: [] })).toBe(true);
    expect(isPresentedAdmit({ admit: { ...admit, carriageCommit: "x" }, lineage: [] })).toBe(false);
  });

  test("the partial carries the opening beside its own commitment alone, and a cosign keeps it", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 951 });
    const opening = openAdmitCarriage(carriageOf(PIN_A));
    const admit = await admitAt(charter, new Uint8Array(32).fill(111), opening);
    const partial = nexusActPartial(charter.aid, { family: "admit", entry: admit, opening });
    expect(partial.act.family === "admit" && partial.act.opening).toEqual(opening);
    expect(partial.act.family === "admit" && partial.act.entry.carriageCommit).toBe(admit.carriageCommit);
    const asCarried = JSON.parse(JSON.stringify(partial)) as Record<string, any>;
    expect(readNexusActPartial(asCarried)).toEqual(partial);
    // An opening that answers another commitment, or rides beside none, tears the partial.
    expect(readNexusActPartial({ ...asCarried, act: { ...asCarried.act, opening: { ...opening, salt: "ef".repeat(32) } } })).toBeNull();
    const bare = await admitAt(charter, new Uint8Array(32).fill(112));
    expect(readNexusActPartial({ ...asCarried, subject: { kind: "nym", nym: bare.nym }, act: { family: "admit", entry: bare, opening } })).toBeNull();
    // CONTROL: the same partial without its opening still reads.
    expect(readNexusActPartial({ ...asCarried, act: { family: "admit", entry: asCarried.act.entry } })).not.toBeNull();
  });

  test("the verifier stands in the barrel", () => {
    for (const name of ["verifySignedAdmitBundle", "readAdmitCarriage", "readAdmitOpening", "admitCarriageCommit", "openAdmitCarriage"]) {
      expect(Object.keys(mesh)).toContain(name);
    }
  });
});
