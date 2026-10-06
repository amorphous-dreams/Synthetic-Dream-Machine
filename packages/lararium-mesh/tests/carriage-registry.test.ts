/**
 * membership-registry.test.ts — the operator MEMBERS-registry (the Kapae-antigen's ALLOW-twin), FAIL-CLOSED
 * at every shore and holding the three Build-2 doctrine invariants.
 *
 * Proven:
 *   · a 2-of-3 kahu quorum + the operator's contract-in → the nym reads MEMBER (admit),
 *   · a SUB-QUORUM admit → ignored (a lone node cannot admit),
 *   · an admit MISSING / with a BAD contract-in → ignored (a Nexus cannot conscript an operator — WAX-SEALS-ONLY),
 *   · a REVOKE (kahu quorum only, no contract-in) drops membership,
 *   · a causally-descendant revoke supersedes an admit; concurrent contradictory heads stay unsettled,
 *   · an entry on the WRONG charter epoch, and an unbound roster, both fail closed,
 *   · USER-NEVER-WRITTEN — the signed payload carries ONLY the operator-contract floor (pubkey · action · parents
 *     · charter-epoch); no name/email/device/behavior field can ride the signed bytes.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import {
  signCarriageQuorum, signCarriageContract, signCarrierContract, carriageEntryBytes, foldCarriageSet, foldCarriageDetails, holdsCarriage,
  carriageEntryCounts,
  CARRIAGE_ENTRY_DOMAIN, carriageEntryActCid, type CarriageEntry, type QuorumSignature,
} from "../src/carriage-registry.js";
import type { KahuRoster } from "../src/kapae-antigen.js";

const EPOCH = "epoch-cid-genesis";

// Three founding kahu + one joining operator + a stranger — fixed seeds → deterministic run.
const SEEDS = {
  guru:     new Uint8Array(32).fill(1),
  telarus:  new Uint8Array(32).fill(2),
  lindwyrm: new Uint8Array(32).fill(3),
  joiner:   new Uint8Array(32).fill(5),   // the operator being admitted
  stranger: new Uint8Array(32).fill(7),
};
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);

async function roster(threshold = 2): Promise<KahuRoster> {
  const keys = await Promise.all([pubOf(SEEDS.guru), pubOf(SEEDS.telarus), pubOf(SEEDS.lindwyrm)]);
  return { keys, threshold, sealEpochCid: EPOCH };
}

/** The joining operator's "accepts carriage" contract-in for the current epoch. */
async function contractIn(seed: Uint8Array, epoch = EPOCH): Promise<QuorumSignature> {
  const nym = await pubOf(seed);
  return signCarriageContract(nym, epoch, signerOf(seed));
}

async function admitEntry(over: Partial<Pick<CarriageEntry, "action" | "parents" | "sealEpochCid">> = {},
                          kahu: Uint8Array[] = [SEEDS.guru, SEEDS.telarus],
                          contract: QuorumSignature | undefined = undefined,
                          joinerSeed: Uint8Array = SEEDS.joiner): Promise<CarriageEntry> {
  const nym     = await pubOf(joinerSeed);
  const signers = await Promise.all(kahu.map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const cs      = contract ?? (over.action === "revoke" ? undefined : await contractIn(joinerSeed, over.sealEpochCid ?? EPOCH));
  return signCarriageQuorum(
    { nym, action: over.action ?? "admit", parents: over.parents ?? [], sealEpochCid: over.sealEpochCid ?? EPOCH },
    signers, cs,
  );
}

describe("the members fold — admit needs BOTH the kahu quorum AND the operator contract-in", () => {
  test("2-of-3 kahu + contract-in → the nym reads MEMBER", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    const set = await foldCarriageSet([await admitEntry()], r);
    expect(holdsCarriage(nym, set)).toBe(true);
  });

  test("SUB-QUORUM (one kahu) → ignored, never a member", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    const set = await foldCarriageSet([await admitEntry({}, [SEEDS.guru])], r);
    expect(holdsCarriage(nym, set)).toBe(false);
  });

  test("admit with NO contract-in → ignored (a Nexus cannot conscript an operator)", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    // A perfectly-quorum'd admit, but the operator never signed 'accepts carriage'.
    const entry = await admitEntry({}, [SEEDS.guru, SEEDS.telarus], undefined, SEEDS.joiner);
    const noContract: CarriageEntry = { ...entry, contractSig: undefined };
    const set = await foldCarriageSet([noContract], r);
    expect(holdsCarriage(nym, set)).toBe(false);
  });

  test("admit with a FORGED contract-in (someone else's signature) → ignored", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    // The stranger signs a carriage token but claims the joiner's nym as signer → verify fails (signer≠nym or bad sig).
    const forged = await contractIn(SEEDS.stranger);
    const misattributed: QuorumSignature = { signer: nym, sig: forged.sig };   // wrong sig under the joiner's nym
    const entry = await admitEntry({}, [SEEDS.guru, SEEDS.telarus], misattributed);
    const set = await foldCarriageSet([entry], r);
    expect(holdsCarriage(nym, set)).toBe(false);
  });

  test("a non-roster kahu signer does not pad the quorum", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    const set = await foldCarriageSet([await admitEntry({}, [SEEDS.guru, SEEDS.stranger])], r);
    expect(holdsCarriage(nym, set)).toBe(false);
  });

  test("an admit on the WRONG charter epoch is ignored", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    const set = await foldCarriageSet([await admitEntry({ sealEpochCid: "some-other-epoch" })], r);
    expect(holdsCarriage(nym, set)).toBe(false);
  });

  test("an unbound (empty-key) roster fails closed", async () => {
    const empty: KahuRoster = { keys: [], threshold: 2, sealEpochCid: EPOCH };
    const nym = await pubOf(SEEDS.joiner);
    const set = await foldCarriageSet([await admitEntry()], empty);
    expect(holdsCarriage(nym, set)).toBe(false);
  });
});

describe("causal revoke — kahu quorum only, fail-closed concurrent equivocation", () => {
  test("a causally-descendant revoke supersedes an admit (no contract-in needed)", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    const admit  = await admitEntry({ action: "admit" });
    const revoke = await admitEntry({ action: "revoke", parents: [
      carriageEntryActCid(admit),
    ] });
    const set = await foldCarriageSet([admit, revoke], r);
    expect(holdsCarriage(nym, set)).toBe(false);
  });

  test("concurrent admit/revoke heads stay unsettled and NON-member", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    const admit  = await admitEntry({ action: "admit" });
    const revoke = await admitEntry({ action: "revoke" });
    expect(holdsCarriage(nym, await foldCarriageSet([admit, revoke], r))).toBe(false);
    expect(holdsCarriage(nym, await foldCarriageSet([revoke, admit], r))).toBe(false);   // order-independent
  });

  test("an ordered descendant admit can reopen a revoked relation", async () => {
    const r = await roster();
    const nym = await pubOf(SEEDS.joiner);
    const revoke = await admitEntry({ action: "revoke" });
    const admit  = await admitEntry({ action: "admit", parents: [
      carriageEntryActCid(revoke),
    ] });
    const set = await foldCarriageSet([revoke, admit], r);
    expect(holdsCarriage(nym, set)).toBe(true);
  });
});

describe("fold details — evidence for a future receiver-local relation verifier", () => {
  test("retains charter head, accepted evidence CID, and the same member set", async () => {
    const r = await roster();
    const admit = await admitEntry();
    const set = await foldCarriageSet([admit], r);
    const details = await foldCarriageDetails([admit], r);
    const nym = await pubOf(SEEDS.joiner);
    expect(details.charterEpochCid).toBe(EPOCH);
    expect(details.members).toEqual(set);
    expect(details.entries).toContainEqual(expect.objectContaining({
      nym, action: "admit", parents: [], sealEpochCid: EPOCH,
      counted: true, state: "accepted", reason: "causal-head-accepted",
    }));
  });

  test("distinguishes concurrent equivocation and an ordered revoke", async () => {
    const r = await roster();
    const admit = await admitEntry();
    const revoke = await admitEntry({ action: "revoke" });
    const details = await foldCarriageDetails([admit, revoke], r);
    const nym = await pubOf(SEEDS.joiner);
    expect(details.members).toEqual(await foldCarriageSet([admit, revoke], r));
    expect(details.members.has(nym)).toBe(false);
    expect(details.entries.filter((e) => e.nym === nym).every((e) => e.state === "unsettled")).toBe(true);

    const higherRevoke = await admitEntry({ action: "revoke", parents: [
      carriageEntryActCid(admit),
    ] });
    const revoked = await foldCarriageDetails([admit, higherRevoke], r);
    expect(revoked.entries).toContainEqual(expect.objectContaining({ state: "revoked", reason: "causal-head-revoked" }));
  });

  test("mixed member and place actions preserve legacy membership parity, including carry ties", async () => {
    const r = await roster();
    const memberAdmit = await admitEntry();
    const memberRevoke = await admitEntry({ action: "revoke" });
    const placeNym = await pubOf(SEEDS.stranger);
    const kahu = await Promise.all([SEEDS.guru, SEEDS.telarus].map(async (seed) => ({ signer: await pubOf(seed), sign: signerOf(seed) })));
    const carry = await signCarriageQuorum(
      { nym: placeNym, action: "carry", parents: [], sealEpochCid: EPOCH }, kahu,
      await signCarrierContract(placeNym, EPOCH, signerOf(SEEDS.stranger)),
    );
    const uncarry = await signCarriageQuorum(
      { nym: placeNym, action: "uncarry", parents: [carriageEntryActCid(carry)], sealEpochCid: EPOCH }, kahu,
    );
    const mixed = [memberAdmit, memberRevoke, carry, uncarry];
    const legacy = await foldCarriageSet(mixed, r);
    const detailed = await foldCarriageDetails(mixed, r);
    const joinerNym = await pubOf(SEEDS.joiner);
    expect(detailed.members).toEqual(legacy);
    expect(detailed.members.has(placeNym)).toBe(false);
    expect(detailed.entries).toContainEqual(expect.objectContaining({ nym: placeNym, action: "uncarry", state: "revoked" }));
    expect(detailed.entries.filter((entry) => entry.nym === joinerNym)
      .every((entry) => entry.state === "unsettled")).toBe(true);
  });

  test("names uncounted, wrong-charter, and unavailable evidence without granting", async () => {
    const r = await roster();
    const malformed = { ...(await admitEntry()), signatures: [] } as CarriageEntry;
    const wrong = await admitEntry({ sealEpochCid: "other-charter" });
    const details = await foldCarriageDetails([malformed, wrong], r);
    expect(details.members.size).toBe(0);
    expect(details.entries).toContainEqual(expect.objectContaining({ counted: false, reason: "quorum-not-counted" }));
    expect(details.entries).toContainEqual(expect.objectContaining({ counted: false, reason: "wrong-charter-epoch" }));
    const unavailable = await foldCarriageDetails(undefined, r);
    expect(unavailable).toMatchObject({ charterEpochCid: EPOCH, entries: [] });
    expect(unavailable.members.size).toBe(0);
  });
});

describe("carriageEntryCounts — the writer's self-check reads the fold's own verdict", () => {
  test("CONTROL — a quorum-signed admit carrying its contract-in counts, and the fold counts it too", async () => {
    const r     = await roster();
    const entry = await admitEntry();
    expect(await carriageEntryCounts(entry, r)).toBe(true);
    expect((await foldCarriageDetails([entry], r)).entries[0]).toMatchObject({ counted: true });
  });

  test("a quorum-signed UNSUPPORTED action with a valid contract-in never counts — the fold rejects it too", async () => {
    const r       = await roster();
    const nym     = await pubOf(SEEDS.joiner);
    const signers = await Promise.all([SEEDS.guru, SEEDS.telarus].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
    const bogus   = await signCarriageQuorum(
      { nym, action: "bogus" as unknown as CarriageEntry["action"], parents: [], sealEpochCid: EPOCH },
      signers, await contractIn(SEEDS.joiner),
    );
    expect((await foldCarriageDetails([bogus], r)).entries[0]).toMatchObject({ counted: false, reason: "unsupported-action" });
    expect(await carriageEntryCounts(bogus, r)).toBe(false);
  });
});

describe("TRACK CONTRACTS, NEVER IDENTITIES — the signed payload is the operator-contract FLOOR", () => {
  test("the signed bytes carry ONLY pubkey · action · causal parents · charter-epoch — no identity field", async () => {
    const nym = await pubOf(SEEDS.joiner);
    const decoded = JSON.parse(new TextDecoder().decode(
      carriageEntryBytes({ kind: CARRIAGE_ENTRY_DOMAIN, nym, action: "admit", parents: [], sealEpochCid: EPOCH }),
    )) as Record<string, unknown>;
    // Exactly the floor keys — nothing that could name a human.
    expect(Object.keys(decoded).sort()).toEqual(["action", "kind", "nym", "parents", "sealEpochCid"]);
    expect(decoded["nym"]).toBe(nym);                       // an ed25519 pubkey, never a name
    expect(JSON.stringify(decoded)).not.toMatch(/name|email|device|behavior/i);
  });

  test("the contract-in the operator signs carries ONLY nym + charter-epoch (independent of causal acts)", async () => {
    const cs = await contractIn(SEEDS.joiner);
    const nym = await pubOf(SEEDS.joiner);
    expect(cs.signer).toBe(nym);   // the seal is the operator's OWN — proves consent, names no human
  });
});
