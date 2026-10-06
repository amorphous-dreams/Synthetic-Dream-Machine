/**
 * The door a recognised operator walks through to raise a vessel — recognition read by the VERIFIER.
 *
 * A grant carries its recogniser's own admit for the challenge's Nexus and is signed by that admit's LEAF.
 * The vessel judges the admit against what it reads for the Nexuses it carries (roster head, deny board,
 * antigen) and raises only on `held`, for the Nexus the challenge names, signed by the admit's leaf.
 *
 * The starred tests carry the security properties rather than the mechanics. Each of them, failing, still
 * leaves a system that raises vessels correctly on every honest input — which is exactly why they exist.
 */
import { RAISE_CHALLENGE_DOMAIN } from "../src/domains.js";
import { describe, expect, test } from "vitest";

import {
  mintRaiseChallenge, raiseChallengeBytes, signRaiseGrant, verifyRaiseGrant,
  type RaiseChallenge, type RaiseGrant, type RaiseNexusReading, type RaisePresentedAdmit,
} from "../src/raise-challenge.js";
import { raiseStands, standingClass } from "../src/vessel-standing.js";
import { carriageEntryActCid, type CarriageEntry } from "../src/carriage-registry.js";
import { ed25519VerifyHex } from "../src/auth-wire.js";
import { pubOf, signerOf, kahuRoster, carriageAct } from "./fixtures/carriage.js";

const VESSEL = "vessel-key-hex";
const NEXUS  = "aid-of-nexus-n";
const OTHER  = "aid-of-nexus-q";
const EPOCH_N  = "epoch-cid-n-genesis";
const EPOCH_N2 = "epoch-cid-n-rolled";
const EPOCH_Q  = "epoch-cid-q-genesis";

const SEEDS = {
  k0:    new Uint8Array(32).fill(1),
  k1:    new Uint8Array(32).fill(2),
  k2:    new Uint8Array(32).fill(3),
  leaf:  new Uint8Array(32).fill(5),
  root:  new Uint8Array(32).fill(6),
  other: new Uint8Array(32).fill(9),
};
const KAHU = [SEEDS.k0, SEEDS.k1];

const challenge = (over: Partial<RaiseChallenge> = {}): RaiseChallenge =>
  mintRaiseChallenge({ vesselId: VESSEL, nexus: NEXUS, epoch: 7, nonce: "nonce-A", ...over });

const verify = (nym: string, bytes: Uint8Array, sig: string) => ed25519VerifyHex(sig, bytes, nym);

const act = (action: "admit" | "revoke", parents: readonly string[] = [], subject = SEEDS.leaf, epoch = EPOCH_N) =>
  carriageAct(subject, action, { kahu: KAHU, epoch, parents });
const cid = (e: CarriageEntry) => carriageEntryActCid(e);

/** The vessel's reading of one carried Nexus: a roster at `epoch`, and the board read as a deny board. */
async function reading(aid: string, epoch: string, denyBoard: readonly CarriageEntry[] = []): Promise<RaiseNexusReading> {
  const roster = await kahuRoster([SEEDS.k0, SEEDS.k1, SEEDS.k2], 2, epoch);
  return { aid, roster, denyBoard, antigen: [], antigenRoster: roster };
}

/** A grant: signed by `signer` under the name `byNym`, carrying `presented`. Defaults to the honest leaf. */
async function grantFor(
  c: RaiseChallenge, presented: RaisePresentedAdmit,
  over: { signer?: Uint8Array; byNym?: string } = {},
): Promise<RaiseGrant> {
  const signer = over.signer ?? SEEDS.leaf;
  return signRaiseGrant({
    challenge: c, presentedAdmit: presented, byNym: over.byNym ?? await pubOf(signer), sign: signerOf(signer),
  });
}

const read = (grant: RaiseGrant, live: RaiseChallenge | null, readings: readonly RaiseNexusReading[]) =>
  verifyRaiseGrant({ grant, live, readings, verify });

/** The honest world: N carried, the leaf admitted on N at its head, nothing closing it. */
async function world() {
  const admit = await act("admit");
  const presented: RaisePresentedAdmit = { admit, lineage: [] };
  const readings = [await reading(NEXUS, EPOCH_N, [admit])];
  return { admit, presented, readings, leaf: await pubOf(SEEDS.leaf) };
}

describe("the honest path", () => {
  test("★ a held admit plus a LEAF-signed grant raises, and the caps ride the leaf ★", async () => {
    const { presented, readings, leaf } = await world();
    const c = challenge();
    const r = await read(await grantFor(c, presented), c, readings);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.caps).toEqual({ byNym: leaf, nexus: NEXUS, boundEpoch: 7 });
  });

  test("the minted caps stand under the fence, and fall when it rolls past", async () => {
    const { presented, readings } = await world();
    const c = challenge();
    const r = await read(await grantFor(c, presented), c, readings);
    if (!r.ok) throw new Error(`expected a raise, got ${r.why}`);
    expect(raiseStands(r.caps, { nexus: NEXUS, effective: 7 })).toBe(true);
    expect(raiseStands(r.caps, { nexus: NEXUS, effective: 8 })).toBe(false);
    expect(standingClass("herm", r.caps, { nexus: NEXUS, effective: 7 })).toBe("hearth");
    expect(standingClass("herm", r.caps, { nexus: NEXUS, effective: 8 })).toBe("herm");
  });

  test("a re-admit after a revoke raises — the lineage covers the revoke it supersedes", async () => {
    const first  = await act("admit");
    const revoke = await act("revoke", [cid(first)]);
    const again  = await act("admit", [cid(revoke)]);
    const c = challenge();
    const r = await read(
      await grantFor(c, { admit: again, lineage: [first, revoke] }), c,
      [await reading(NEXUS, EPOCH_N, [first, revoke, again])],
    );
    expect(r.ok).toBe(true);
  });
});

describe("★ only the admit's LEAF raises — never the root, never a bare nym ★", () => {
  test("★ CONTROL: a ROOT-signed grant beside the same held admit refuses ★", async () => {
    // The root names a key the admit does not: the root never reaches a raise.
    const { presented, readings } = await world();
    const c = challenge();
    const r = await read(await grantFor(c, presented, { signer: SEEDS.root }), c, readings);
    expect(r).toMatchObject({ ok: false, why: "rejected", detail: "signer-is-not-the-admit-leaf" });
  });

  test("★ CONTROL: the leaf's NAME with the root's signature refuses ★", async () => {
    const { presented, readings, leaf } = await world();
    const c = challenge();
    const r = await read(await grantFor(c, presented, { signer: SEEDS.root, byNym: leaf }), c, readings);
    expect(r).toMatchObject({ ok: false, why: "bad-signature" });
  });

  test("★ CONTROL: byNym ≠ admit.nym refuses, though the signer's own signature verifies ★", async () => {
    // Another key signs honestly under its own name, carrying someone else's admit.
    const { presented, readings } = await world();
    const c = challenge();
    const r = await read(await grantFor(c, presented, { signer: SEEDS.other }), c, readings);
    expect(r).toMatchObject({ ok: false, why: "rejected", detail: "signer-is-not-the-admit-leaf" });
  });

  test("★ CONTROL: a nym the board admits, presenting NO admit, refuses — the board is no allow roster ★", async () => {
    const { admit, readings } = await world();                         // the board holds the leaf's admit
    const c = challenge();
    const bare = { challenge: c, byNym: admit.nym, sig: (await grantFor(c, { admit, lineage: [] })).sig } as unknown as RaiseGrant;
    expect(await read(bare, c, readings)).toMatchObject({ ok: false, why: "rejected", detail: "no-presented-admit" });
  });
});

describe("★ the admit is read against the challenge's Nexus ★", () => {
  test("★ CONTROL: a leaf whose admit a DESCENDING revoke closes refuses ★", async () => {
    const { admit, presented } = await world();
    const revoke = await act("revoke", [cid(admit)]);
    const c = challenge();
    const r = await read(await grantFor(c, presented), c, [await reading(NEXUS, EPOCH_N, [admit, revoke])]);
    expect(r).toMatchObject({ ok: false, why: "denied", detail: "revoke-descends-from-admit" });
  });

  test("★ a revoke CONCURRENT with the admit leaves it unsettled, and that refuses ★", async () => {
    const { admit, presented } = await world();
    const concurrent = await act("revoke", []);
    const c = challenge();
    const r = await read(await grantFor(c, presented), c, [await reading(NEXUS, EPOCH_N, [admit, concurrent])]);
    expect(r).toMatchObject({ ok: false, why: "unsettled" });
  });

  test("★ CONTROL: an admit for ANOTHER carried Nexus refuses ★", async () => {
    const qAdmit = await act("admit", [], SEEDS.leaf, EPOCH_Q);
    const c = challenge();
    const readings = [await reading(NEXUS, EPOCH_N), await reading(OTHER, EPOCH_Q, [qAdmit])];
    const r = await read(await grantFor(c, { admit: qAdmit, lineage: [] }), c, readings);
    expect(r).toMatchObject({ ok: false, why: "wrong-nexus", detail: "admit-for-another-nexus" });
  });

  test("★ an admit for a Nexus this vessel does not carry reads WRONG-EPOCH against the challenge's ★", async () => {
    const qAdmit = await act("admit", [], SEEDS.leaf, EPOCH_Q);
    const c = challenge();
    const r = await read(await grantFor(c, { admit: qAdmit, lineage: [] }), c, [await reading(NEXUS, EPOCH_N)]);
    expect(r).toMatchObject({ ok: false, why: "wrong-epoch" });
  });

  test("★ after the charter rolls, the old admit reads WRONG-EPOCH — fail-closed at a seal roll ★", async () => {
    const { admit, presented } = await world();
    const c = challenge();
    const r = await read(await grantFor(c, presented), c, [await reading(NEXUS, EPOCH_N2, [admit])]);
    expect(r).toMatchObject({ ok: false, why: "wrong-epoch", detail: "admit-not-at-head-epoch" });
  });

  test("★ a challenge naming a Nexus this vessel does not carry raises nobody ★", async () => {
    const { presented } = await world();
    const c = challenge();
    const r = await read(await grantFor(c, presented), c, [await reading(OTHER, EPOCH_Q)]);
    expect(r).toMatchObject({ ok: false, why: "wrong-nexus", detail: "challenge-nexus-not-carried" });
  });

  test("★ a tampered admit (a quorum signature cut) refuses ★", async () => {
    const { admit, readings } = await world();
    const torn = { ...admit, signatures: admit.signatures.slice(0, 1) };
    const c = challenge();
    const r = await read(await grantFor(c, { admit: torn, lineage: [] }), c, readings);
    expect(r).toMatchObject({ ok: false, why: "rejected" });
  });
});

describe("★ the freshness is VERIFIER-CHOSEN — no pre-baked blob ★", () => {
  test("★ a captured grant REPLAYED against a new challenge refuses ★", async () => {
    // The break this door exists to close: a vessel at the floor holds no clock, so material PRESENTED to
    // it would replay forever. A thief with the disk and one captured packet must get nothing.
    const { presented, readings } = await world();
    const stolen = await grantFor(challenge({ nonce: "nonce-A" }), presented);
    const r = await read(stolen, challenge({ nonce: "nonce-B" }), readings);
    expect(r).toMatchObject({ ok: false, why: "stale-challenge" });
  });

  test("★ a grant answers NOTHING when the vessel asked nothing ★", async () => {
    const { presented, readings } = await world();
    expect(await read(await grantFor(challenge(), presented), null, readings)).toMatchObject({ ok: false, why: "stale-challenge" });
  });

  test("★ a grant minted under a PRIOR lease epoch refuses even with the right nonce ★", async () => {
    const { presented, readings } = await world();
    const r = await read(await grantFor(challenge({ epoch: 6 }), presented), challenge({ epoch: 7 }), readings);
    expect(r).toMatchObject({ ok: false, why: "stale-challenge" });
  });
});

describe("★ a grant is answerable only where it was provoked ★", () => {
  test("★ a grant for ANOTHER vessel refuses ★", async () => {
    const { presented, readings } = await world();
    const r = await read(await grantFor(challenge({ vesselId: "some-other-vessel" }), presented), challenge(), readings);
    expect(r).toMatchObject({ ok: false, why: "wrong-vessel" });
  });

  test("★ a grant naming another NEXUS than the live challenge refuses ★", async () => {
    const { presented, readings } = await world();
    const r = await read(await grantFor(challenge({ nexus: OTHER }), presented), challenge(), readings);
    expect(r).toMatchObject({ ok: false, why: "wrong-nexus", detail: "challenge-names-another-nexus" });
  });
});

describe("★ the signature is required ★", () => {
  test("★ the leaf's name with a FORGED signature refuses ★", async () => {
    const { presented, readings, leaf } = await world();
    const c = challenge();
    const forged: RaiseGrant = { challenge: c, byNym: leaf, sig: "ab".repeat(64), presentedAdmit: presented };
    expect(await read(forged, c, readings)).toMatchObject({ ok: false, why: "bad-signature" });
  });

  test("★ a leaf signature over DIFFERENT bytes than the challenge refuses ★", async () => {
    const { presented, readings } = await world();
    const c = challenge();
    const other = await grantFor(challenge({ nonce: "nonce-Z" }), presented);
    const swapped: RaiseGrant = { ...(await grantFor(c, presented)), sig: other.sig };
    expect(await read(swapped, c, readings)).toMatchObject({ ok: false, why: "bad-signature" });
  });
});

describe("the signed bytes", () => {
  test("carry the whole challenge — no field can move without breaking the signature", async () => {
    const seen = new Set<string>();
    for (const c of [
      challenge(),
      challenge({ vesselId: "v2" }), challenge({ nexus: "n2" }),
      challenge({ epoch: 8 }),       challenge({ nonce: "nonce-B" }),
    ]) seen.add(Buffer.from(raiseChallengeBytes(c)).toString("hex"));
    expect(seen.size).toBe(5);
  });

  test("carry a domain tag, so a raise signature replays as no other act", () => {
    expect(Buffer.from(raiseChallengeBytes(challenge())).toString("utf8")).toContain(RAISE_CHALLENGE_DOMAIN);
  });

  test("carry NOTHING of the vessel's contents — a challenge is not a disclosure", () => {
    const text = Buffer.from(raiseChallengeBytes(challenge())).toString("utf8");
    const fields = Object.keys(JSON.parse(text) as Record<string, unknown>).sort();
    expect(fields).toEqual(["epoch", "kind", "nexus", "nonce", "vesselId"]);
  });
});
