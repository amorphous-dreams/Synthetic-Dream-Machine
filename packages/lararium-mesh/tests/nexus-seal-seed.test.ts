/**
 * nexus-seal-seed.test — the ROSTER-FROM-DOC read, FAIL-CLOSED at every unseated shore (#66).
 *
 * Proven:
 *   · a null / absent doc folds to the EMPTY roster (the antigen ignores every entry),
 *   · a doc with no established charter epoch fails closed even with keys present,
 *   · an unseated doc (keys null) fails closed,
 *   · a seated doc with an established epoch raises a LIVE roster that a real 2-of-3 antigen entry verifies,
 *   · the Nexus AID: the genesis epoch's `nexus-` address, fixed across a roll, moved by any genesis byte,
 *   · a below-threshold seated roster fails closed.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import {
  foundingRoster, foundingQuorumSeated, nexusAidOf,
  sealLineageHead, emptyFoundingCharterDoc, NEXUS_DOC_DOMAIN, type NexusDoc,
} from "../src/nexus-seal-seed.js";
import { mintCharterEpoch, sealEpochCidOf, NEXUS_AID_PATTERN } from "../src/wax-stamp.js";
import { namedCharter, seatedCharter, type SeatedCharter } from "./charter-fixture.js";
import { signAntigenEntry, foldAntigenSet, isKapaed, makeMultiSigQuorumVerifier } from "../src/kapae-antigen.js";

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const verifier = makeMultiSigQuorumVerifier();
const VICTIM = "deadbeef".repeat(8);
const CHAIRS = ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"] as const;

/** The doc a fixture charter seats: its chairs hold the head's keys, its lineage the whole chain. */
function docOf(charter: SeatedCharter): NexusDoc {
  return {
    kind: NEXUS_DOC_DOMAIN, threshold: 2,
    sealEpochCid: charter.head.epochCid, sealLineage: [...charter.chain],
    kahu: charter.keys.map((verifyingKey, i) => ({ chairLabel: CHAIRS[i]!, verifyingKey })),
  };
}

/** A doc seated with `seats` of the three founding kahu on a one-epoch lineage bound to the seated key-set,
 *  beside the charter whose hands sign for it. Below the threshold of two no epoch stands: the one chair holds
 *  its key and the doc carries no lineage. */
async function seated(seats: 1 | 2 | 3): Promise<{ doc: NexusDoc; charter: SeatedCharter }> {
  if (seats < 2) {
    const charter = await seatedCharter({ seats, threshold: 1, armed: false });
    const kahu = CHAIRS.map((chairLabel, i) => ({ chairLabel, verifyingKey: charter.keys[i] ?? null }));
    return { doc: { kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: null, kahu }, charter };
  }
  const charter = await seatedCharter({ seats, threshold: 2, armed: false });
  return { doc: docOf(charter), charter };
}
const seatedDoc = async (seats: 1 | 2 | 3): Promise<NexusDoc> => (await seated(seats)).doc;

describe("foundingRoster — fail-closed reads", () => {
  test("a null doc folds to the empty roster", () => {
    const r = foundingRoster(null);
    expect(r.keys).toEqual([]);
    expect(r.sealEpochCid).toBe("");
  });

  test("the unseated scaffold folds to the empty roster (no keys, no epoch)", () => {
    const r = foundingRoster(emptyFoundingCharterDoc());
    expect(r.keys).toEqual([]);
    expect(r.sealEpochCid).toBe("");
    expect(foundingQuorumSeated(emptyFoundingCharterDoc())).toBe(false);
  });

  test("keys present but NO epoch → fail closed (nothing roots)", async () => {
    const doc = await seatedDoc(2);
    const noEpoch: NexusDoc = { ...doc, sealEpochCid: null, sealLineage: undefined };
    expect(foundingRoster(noEpoch).keys).toEqual([]);
    expect(foundingQuorumSeated(noEpoch)).toBe(false);
  });

  test("a below-threshold seated roster fails closed (one key, no epoch established)", async () => {
    const doc = await seatedDoc(1);
    expect(doc.sealEpochCid).toBeNull();
    expect(foundingQuorumSeated(doc)).toBe(false);
  });

  test("keys present, a NON-NULL bare sealEpochCid, but NO sealLineage → fail closed (a bare inception path never roots)", async () => {
    const doc = await seatedDoc(3);
    const legacy: NexusDoc = { ...doc, sealLineage: undefined, sealEpochCid: "legacy-bare-epoch" };
    expect(foundingRoster(legacy).keys).toEqual([]);
    expect(foundingRoster(legacy).sealEpochCid).toBe("");
    expect(foundingQuorumSeated(legacy)).toBe(false);
  });
});

describe("foundingRoster — a seated doc raises a LIVE antigen roster", () => {
  test("a 2-of-3 seated doc verifies a real quorum-signed antigen entry", async () => {
    const { doc, charter } = await seated(3);
    const roster = foundingRoster(doc);
    expect(roster.keys.length).toBe(3);
    expect(roster.sealEpochCid).not.toBe("");
    expect(foundingQuorumSeated(doc)).toBe(true);

    // Two founding kahu sign a ban rooting on the doc's own charter epoch → the nym stands Kapae'd.
    const signers = await charter.signers([0, 1]);
    const entry = await signAntigenEntry(
      { nym: VICTIM, action: "kapae", parents: [], sealEpochCid: roster.sealEpochCid },
      signers,
    );
    const set = await foldAntigenSet([entry], roster, verifier);
    expect(isKapaed(VICTIM, set)).toBe(true);
  });

  test("an entry rooting on a DIFFERENT epoch than the doc establishes is ignored", async () => {
    const { doc, charter } = await seated(2);
    const roster = foundingRoster(doc);
    const signers = await charter.signers();
    const entry = await signAntigenEntry(
      { nym: VICTIM, action: "kapae", parents: [], sealEpochCid: "nexus-someone-elses" },
      signers,
    );
    expect(isKapaed(VICTIM, await foldAntigenSet([entry], roster, verifier))).toBe(false);
  });
});

describe("foundingRoster — the PRE-ROTATED CHAIN roots the antigen on the verified HEAD (#68)", () => {
  /** An armed fixture charter of `seats` chairs, rolled once when asked, beside the doc it seats. */
  async function chained(seats: 2 | 3, rolled = false): Promise<{ doc: NexusDoc; charter: SeatedCharter }> {
    const genesis = await seatedCharter({ seats, threshold: 2 });
    const charter = rolled ? await genesis.roll() : genesis;
    return { doc: docOf(charter), charter };
  }
  const chainedDoc = async (seats: 2 | 3, rolled = false): Promise<NexusDoc> => (await chained(seats, rolled)).doc;

  test("a chain-rooted genesis doc raises a live roster on the head epoch + verifies a real quorum entry", async () => {
    const { doc, charter } = await chained(3);
    const roster = foundingRoster(doc);
    expect(roster.keys.length).toBe(3);
    expect(roster.sealEpochCid).toBe(sealLineageHead(doc)!.epochCid);
    expect(foundingQuorumSeated(doc)).toBe(true);

    const signers = await charter.signers([0, 1]);
    const entry = await signAntigenEntry({ nym: VICTIM, action: "kapae", parents: [], sealEpochCid: roster.sealEpochCid }, signers);
    expect(isKapaed(VICTIM, await foldAntigenSet([entry], roster, verifier))).toBe(true);
  });

  test("after a valid rotate, the roster roots on epoch1's head (the seat→rotate round-trip)", async () => {
    const doc = await chainedDoc(2, true);
    const head = sealLineageHead(doc)!;
    expect(head.predecessors).toEqual([doc.sealLineage![0]!.epochCid]);
    expect(foundingRoster(doc).sealEpochCid).toBe(head.epochCid);
    expect(foundingQuorumSeated(doc)).toBe(true);
  });

  test("★ a rotated chain whose roll carries no revealed-key signature folds to the inert roster ★", async () => {
    const doc = await chainedDoc(2, true);
    const [g, head] = doc.sealLineage!;
    const unsigned: NexusDoc = { ...doc, sealLineage: [g!, { ...head!, roll: { ...head!.roll!, signatures: [] } }] };
    expect(foundingRoster(unsigned).keys).toEqual([]);
    expect(foundingQuorumSeated(unsigned)).toBe(false);
    expect(foundingQuorumSeated(doc)).toBe(true);   // CONTROL: the signed roll stands
  });

  test("a BROKEN chain fails closed to the empty (inert) roster", async () => {
    const doc = await chainedDoc(2);
    const head = doc.sealLineage![0]!;
    const tampered: NexusDoc = { ...doc, sealLineage: [mintCharterEpoch({ ...head, predecessors: ["forged"] })] };
    expect(foundingRoster(tampered).keys).toEqual([]);           // a genesis that names a predecessor → broken lineage
    expect(foundingQuorumSeated(tampered)).toBe(false);
  });

  test("a chain HEAD unbound to the seated key-set fails closed (the seated keys don't hash to head.keySetHash)", async () => {
    const doc = await chainedDoc(2);
    // Swap one seated key for a stranger — the head's keySetHash no longer covers the seated set.
    const stranger = "f".repeat(64);
    const kahu = doc.kahu.map((k, i) => (i === 0 ? { ...k, verifyingKey: stranger } : k));
    const unbound: NexusDoc = { ...doc, kahu };
    expect(foundingRoster(unbound).keys).toEqual([]);
    expect(foundingQuorumSeated(unbound)).toBe(false);
  });
});

describe("the Nexus AID — one constructor, one name", () => {
  test("a seated charter names its Nexus `nexus-…`, the genesis epoch's own address", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2 });
    const doc = charter.doc();
    expect(nexusAidOf(doc)).toBe(charter.chain[0]!.epochCid);
    expect(nexusAidOf(doc)).toMatch(NEXUS_AID_PATTERN);
    expect(nexusAidOf(doc)).toBe(sealEpochCidOf(charter.chain[0]!));       // the one constructor mints it
  });
  test("RED: the AID stays fixed across a roll, and every later epoch reads `epoch-`", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2 });
    const rolled = await charter.roll();
    expect(nexusAidOf(rolled.doc())).toBe(nexusAidOf(charter.doc()));
    expect(rolled.head.epochCid).toMatch(/^epoch-[0-9a-f]{64}$/);
    expect(NEXUS_AID_PATTERN.test(rolled.head.epochCid)).toBe(false);
  });
  test("CONTROL: changed genesis bytes change the AID; an unseated charter names none", async () => {
    const a = await seatedCharter({ seats: 3, threshold: 2, seed: 1 });
    const b = await seatedCharter({ seats: 3, threshold: 2, seed: 2 });
    const c = await seatedCharter({ seats: 3, threshold: 3, seed: 1 });
    expect(nexusAidOf(a.doc())).not.toBe(nexusAidOf(b.doc()));
    expect(nexusAidOf(a.doc())).not.toBe(nexusAidOf(c.doc()));
    // The same seats under the same rule, unarmed: the successor commitments enter the genesis bytes too.
    const unarmed = await seatedCharter({ seats: 3, threshold: 2, seed: 1, armed: false });
    expect(unarmed.keys).toEqual(a.keys);
    expect(nexusAidOf(unarmed.doc())).not.toBe(nexusAidOf(a.doc()));
    expect(nexusAidOf(emptyFoundingCharterDoc())).toBeNull();
    // RED: a genesis address of any other shape names no Nexus, the earlier name among them.
    expect(nexusAidOf(namedCharter(`epoch${0}-${"ab".repeat(32)}`))).toBeNull();
    expect(nexusAidOf(namedCharter("test-aid"))).toBeNull();
    expect(nexusAidOf(namedCharter(`nexus-${"ab".repeat(32)}`))).toBe(`nexus-${"ab".repeat(32)}`);   // CONTROL
    expect(nexusAidOf(null)).toBeNull();
  });
});
