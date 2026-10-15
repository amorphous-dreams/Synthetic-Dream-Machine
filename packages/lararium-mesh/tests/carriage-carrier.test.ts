/**
 * carriage-carrier.test.ts — THE CARRIER CONTRACT: a faceless PLACE enters a Nexus by a contract its own
 * VESSEL key signs, and never enters the member set.
 *
 * The wall this answers (`bags/lares/ha.ka.ba/lares/docs/pono/heraldry.mem` #/the-herm-card): a Nexus knows
 * exactly one way to seat a vessel and it runs through a persona root — `resolveContractIn` obtains the
 * accepts-carriage seal from a HELD persona seed or an out-of-band token from one, and a Herm holds neither
 * (`personaSlotCeiling("herm") === 0`). The refusal guards against conscripting a PERSON; a Herm is a place.
 *
 * Proven here:
 *   · a `carry` entry whose carrier seal the PLACE's own key signed, plus the kahu quorum, COUNTS,
 *   · that entry folds into the CARRIER set and NOT into the member set (`holdsCarriage` reads false),
 *   · a carrier seal signed by a hand OTHER than the named place is ignored (the seal must be its own),
 *   · a MEMBER's accepts-carriage token presented as a carrier seal does NOT verify, and the reverse also
 *     does not — the two domains separate them, so no seal crosses boards,
 *   · a causally-descendant `uncarry` drops the carrier; concurrent contradictory heads stay NON-carrier.
 *
 * CONTROLS: a member admit still needs its persona-signed contract-in and still reads MEMBER (the existing
 * law, unmoved); a nonsense-domain seal verifies as neither carrier nor member.
 */
import { describe, test, expect } from "vitest";
import { canonicalJsonBytes } from "../src/crypto.js";
import {
  signCarriageQuorum, signCarriageContract, signCarrierContract, verifyCarrierContract, carriageEntryActCid,
  foldCarriageSet, foldCarrierSet, holdsCarriage, holdsCarrier,
  type CarriageEntry, type QuorumSignature,
} from "../src/carriage-registry.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";
import { signerOf, pubOf, kahuRoster, kahuSigners, carriageAct } from "./fixtures/carriage.js";

const EPOCH = "epoch-cid-genesis";

const SEEDS = {
  guru:     new Uint8Array(32).fill(1),
  telarus:  new Uint8Array(32).fill(2),
  lindwyrm: new Uint8Array(32).fill(3),
  joiner:   new Uint8Array(32).fill(5),   // a contracting OPERATOR — a person, with a persona root
  herm:     new Uint8Array(32).fill(9),   // a PLACE — its device-minted vessel key, no persona anywhere
  stranger: new Uint8Array(32).fill(7),
};
function roster(threshold = 2): Promise<KahuQuorumSeats> {
  return kahuRoster([SEEDS.guru, SEEDS.telarus, SEEDS.lindwyrm], threshold, EPOCH);
}

/** A `carry` / `uncarry` entry: the kahu quorum, plus (for a carry) the PLACE's own vessel-key seal. */
async function carryEntry(
  over: Partial<Pick<CarriageEntry, "action" | "parents" | "sealEpochCid">> = {},
  kahu: Uint8Array[] = [SEEDS.guru, SEEDS.telarus],
  carrierSig?: QuorumSignature,
  placeSeed: Uint8Array = SEEDS.herm,
): Promise<CarriageEntry> {
  return carriageAct(placeSeed, over.action ?? "carry", {
    kahu, epoch: over.sealEpochCid ?? EPOCH, parents: over.parents ?? [],
    ...(carrierSig ? { seal: carrierSig } : {}),
  });
}

describe("a PLACE contracts as a CARRIER, by its own vessel key, and never becomes a member", () => {
  test("a carry entry the place's OWN key sealed + the kahu quorum → the nym reads CARRIER", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.herm);
    const carriers = await foldCarrierSet([await carryEntry()], r);
    expect(holdsCarrier(nym, carriers)).toBe(true);
  });

  test("★ the CONTROL the class law rides on: that same entry folds into NO member set ★", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.herm);
    const members = await foldCarriageSet([await carryEntry()], r);
    expect(holdsCarriage(nym, members)).toBe(false);
    expect(members.size).toBe(0);
  });

  test("a carrier seal signed by ANOTHER hand is ignored — the place seals for itself or not at all", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.herm);
    const foreign = await signCarrierContract(nym, EPOCH, signerOf(SEEDS.stranger));   // right subject, wrong hand
    const carriers = await foldCarrierSet([await carryEntry({}, undefined, foreign)], r);
    expect(holdsCarrier(nym, carriers)).toBe(false);
  });

  test("a carry with NO seal at all is ignored — a Nexus never conscripts a place either", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.herm);
    const signers = await kahuSigners([SEEDS.guru, SEEDS.telarus]);
    const bare = await signCarriageQuorum({ nym, action: "carry", parents: [], sealEpochCid: EPOCH }, signers);
    expect(holdsCarrier(nym, await foldCarrierSet([bare], r))).toBe(false);
  });

  test("★ the two seals never cross boards — the DOMAIN is the separation ★", async () => {
    const nym = await pubOf(SEEDS.herm);
    const memberSeal  = await signCarriageContract(nym, EPOCH, signerOf(SEEDS.herm));   // accepts-carriage
    const carrierSeal = await signCarrierContract(nym, EPOCH, signerOf(SEEDS.herm));    // carries-for
    expect(memberSeal.sig).not.toBe(carrierSeal.sig);
    // A member's accepts-carriage token presented as a carrier seal does not verify.
    expect(await verifyCarrierContract({ nym, sealEpochCid: EPOCH, sig: memberSeal.sig })).toBe(false);
    // And the carrier seal, carried onto a member ADMIT, leaves the admit uncounted.
    const r = await roster();
    const signers = await kahuSigners([SEEDS.guru, SEEDS.telarus]);
    const crossed = await signCarriageQuorum({ nym, action: "admit", parents: [], sealEpochCid: EPOCH }, signers, carrierSeal);
    expect(holdsCarriage(nym, await foldCarriageSet([crossed], r))).toBe(false);
  });

  test("an ordered uncarry drops the carrier; concurrent uncarry stays NON-carrier", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.herm);
    const carry   = await carryEntry();
    const uncarry = await carryEntry({ action: "uncarry", parents: [carriageEntryActCid(carry)] });
    expect(holdsCarrier(nym, await foldCarrierSet([carry, uncarry], r))).toBe(false);
    const tie = await carryEntry({ action: "uncarry" });
    expect(holdsCarrier(nym, await foldCarrierSet([carry, tie], r))).toBe(false);
  });

  test("a carry on the WRONG charter epoch fails closed", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.herm);
    expect(holdsCarrier(nym, await foldCarrierSet([await carryEntry({ sealEpochCid: "some-other-epoch" })], r))).toBe(false);
  });

  test("a SUB-QUORUM carry is ignored — a lone kahu seats no crossroads", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.herm);
    expect(holdsCarrier(nym, await foldCarrierSet([await carryEntry({}, [SEEDS.guru])], r))).toBe(false);
  });

  test("CONTROL: a member ADMIT still needs its persona-signed contract-in and still reads MEMBER", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    const admit = await carriageAct(SEEDS.joiner, "admit", { kahu: [SEEDS.guru, SEEDS.telarus], epoch: EPOCH });
    expect(holdsCarriage(nym, await foldCarriageSet([admit], r))).toBe(true);
    // …and it is not thereby a carrier.
    expect(holdsCarrier(nym, await foldCarrierSet([admit], r))).toBe(false);
  });

  test("CONTROL: a NONSENSE-domain seal verifies as neither carrier nor member", async () => {
    const nym = await pubOf(SEEDS.herm);
    // A domain this house never minted — spelled OFF the registry's own root on purpose, so the
    // domain-registry witness reads no stray literal here (a control must not look like a declaration).
    const bytes = canonicalJsonBytes({ kind: "a-domain-nobody-minted", nym, sealEpochCid: EPOCH });
    const sig = await signerOf(SEEDS.herm)(bytes);
    expect(await verifyCarrierContract({ nym, sealEpochCid: EPOCH, sig })).toBe(false);
    const r = await roster();
    const signers = await kahuSigners([SEEDS.guru, SEEDS.telarus]);
    const entry = await signCarriageQuorum({ nym, action: "carry", parents: [], sealEpochCid: EPOCH }, signers, { signer: nym, sig });
    expect(holdsCarrier(nym, await foldCarrierSet([entry], r))).toBe(false);
  });
});
