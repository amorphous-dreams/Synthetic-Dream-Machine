/**
 * nexus-contract.test.ts — the CONTRACT side of the operator MEMBERS-registry, end-to-end through the node
 * command, and the presented-admit gate the sharePolicy member gate reads.
 *
 * Proven, against a SYNTHETIC seated roster on a temp LAR_ROOT (real vessel identity, real founder persona-roots,
 * a real Automerge board on disk):
 *   · the full loop ADMIT → board → read → fold → holdsCarriage — a 2-of-3 signed + contract-in admit lands on the
 *     always-carried members board and folds the operator nym to MEMBER (the a-multitude-of-one self-contract),
 *   · a causally-descendant REVOKE drops membership,
 *   · a SUB-QUORUM admit REFUSES (nothing written),
 *   · an UNSEATED charter REFUSES,
 *   · an admit for a nym the vessel does NOT hold, with NO --contract token, REFUSES (no conscription),
 *   · the PRESENTED-ADMIT gate: an admitted leaf that presents its admit (derived off the SAME board the admit
 *     wrote) with a leaf proof reads MEMBER; a seated kahu and the admitted nym's raw wire key, presenting
 *     nothing, read STRANGER — the consult reads no kahu floor and no board fold,
 *   · USER-NEVER-WRITTEN: the board carries operator-pubkey nyms only,
 *   · ONE ADDRESS: with a seal home passed, the admit write and the members-list read key on the SAME island,
 *   · THE CARRIED ADMIT: an admit emits a bundle (entry · lineage · AID · this vessel's gate key) the joinee's
 *     take verifies offline and keeps; a revoke emits none.
 */
import { emptyFoundingCharterDoc } from "@lararium/mesh";
import { beginNexusKeyReissue, faceProofKeyFile, listFaceProofKeys, mintNexusKey, nexusKeyPublicOf } from "../src/face-key-custody.js";
import { runNexusKeyReissue } from "../src/nexus-key-reissue.js";
import { keepKeyLine, readKeyLine } from "../src/carried-set.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { signNexusKeyHandOver, writeNexusKeyHandOver } from "@lararium/mesh";
import { handleRowPath } from "./face-paths.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { restEvery, restingRepo } from "./resting-repo.js";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { hearthSovereignPin } from "../src/hearth-sovereign-pin.js";
import { hex, materializeSharedLarDoc, carriageDocUrl, carriageEntriesFromBoard, signCarriageQuorum, writeCarriageEntry, ed25519SignerFromSeed,
  nexusAidOf, signerClass } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed, loadVesselVerifyingKey, wearPersona,
  listPersonaRoots } from "../src/node-vessel-identity.js";

/** The hands over `keys`: the seat keys this suite names (faces 0-6 across the used generations). */
async function heldHands(keys: readonly string[]): Promise<{ signer: string; sign: (b: Uint8Array) => Promise<string> }[]> {
  const want = new Set(keys.map((k) => k.toLowerCase()));
  const hands: { signer: string; sign: (b: Uint8Array) => Promise<string> }[] = [];
  for (const generation of [0, 1, 2, 3, 4]) {
    for (let face = 0; face < 7; face++) {
      const key = await chairKey(face, generation);
      if (want.has(key)) hands.push({ signer: key, sign: ed25519SignerFromSeed(chairSeed(face, generation)) });
    }
  }
  return hands;
}
import { larDataDir } from "../src/vessel-paths.js";
import { writeNexusDoc, readNexusDoc, nexusCharterDocPath } from "../src/nexus-doc.js";
import { runNexusContract, runNexusAcceptCarriage, runNexusCarryFor, runNexusMembersList, NexusContractError,
  hasContractedInto, runNexusRollAnchor } from "../src/commands/nexus-contract.js";
import { rollAnchorsFromBoard, rollAnchorCid, isRollAnchor, signRollAnchor, writeRollAnchor } from "@lararium/mesh";
import { readConsent, writeConsent, carriageConsentPathFor, carriedCharterHome } from "../src/carried-set.js";
import { signCarriageContract, verifyCarriageConsent } from "@lararium/mesh";
import { existsSync } from "node:fs";
import { larSealHome } from "../src/vessel-paths.js";
import { makeNexusMembership, readCarriedNexuses } from "../src/nexus-carriage.js";
import { heldNexusLeaves, mintNexusLeaf, nexusLeafFor } from "../src/nexus-leaf.js";
import { presentationFromBoardDoc, foundingRoster, type AdmitPresentation } from "@lararium/mesh";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { runRaiseSign } from "../src/commands/raise-sign.js";
import { mintRaiseChallenge, verifyRaiseGrant } from "@lararium/mesh";
import { takeAdmitBundle, readKeptAdmitBundle } from "../src/admit-bundle.js";
import { carriageEntryActCid } from "@lararium/mesh";
import { direct } from "./direct-store.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { chairKey, chairSeed, seatChairs } from "./seat-fixture.js";

let root: string;
let priorLarRoot: string | undefined;
const sealHome = (): string => join(root, "state", "nexus");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-admit-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(async () => {
  // Every Repo this suite opened rests (its adapter closed) before the directory leaves: no save of theirs can land after.
  await restEvery();
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

/**
 * The per-Nexus leaf a held persona presents to the charter standing in the seal home — derived here
 * straight off the mesh primitive, so the expectation never borrows the code under test.
 */
async function leafOf(handleIndex: number): Promise<string> {
  const aid = nexusAidOf(readNexusDoc(sealHome()));
  if (!aid) throw new Error("no charter stands to read a key for");
  // The face's key at the Nexus, minted at random into its sealed row where the face first presents there (as
  // `nexus accept-carriage` mints it), then read straight off that row: no seed relates it to anything.
  return nexusKeyPublicOf(await mintNexusKey(handleIndex, aid));
}

/** A chair label per seat, in seat order. */
const chairs = (keys: readonly string[]): string[] => keys.map((_, i) => `Kahu ${i}`);

/** Seat a charter under a verifiable genesis lineage and return the seated epoch's cid. */
async function seatCharter(keys: string[], threshold = 2): Promise<string> {
  const seated = await seatChairs(keys.map((_, i) => i));
  const charter = heldCharter({ keys: seated.keys, threshold });
  writeNexusDoc(sealHome(), charter.doc({ labels: ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"] }));
  return charter.head.epochCid;
}

describe("nexus admit — the RAISE side end-to-end (Build-2)", () => {
  it("ADMIT (self-contract) → board → fold → holdsCarriage: a 2-of-3 held-root admit contracts the operator", async () => {
    await generateOrLoadVesselIdentity();
    // The vessel holds 4 persona-roots: 0-2 are the founding kahu; 3 is the joining operator it self-contracts.
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const joinerNym = await leafOf(3);   // the persona's per-Nexus leaf, never its PersonaGroup root
    expect(joinerNym).not.toBe(roots[3]!.verifyingKey.toLowerCase());

    const res = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    expect(res.nym).toBe(joinerNym);
    expect(res.parents).toEqual([]);
    expect(res.evidenceCid).toMatch(/^[0-9a-f]{64}$/);
    expect(res.signers).toHaveLength(2);       // exactly the 2-of-3 quorum
    expect(res.contractIn).toBe("self");       // multitude-of-one: the vessel held the joiner's seed
    expect(res.memberHeld).toBe(true);

    const list = await direct(runNexusMembersList)({ sealHome: sealHome() });
    expect(list.members).toContain(joinerNym);
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0]).toMatchObject({ nym: joinerNym, action: "admit", parents: [], signers: 2, contractIn: true });
  });

  it("accept-carriage → admit --contract: a joiner's out-of-band token admits it", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));

    // The joiner mints its 'accepts carriage' token (index 3 on this same vessel stands in for the joiner's vessel).
    const token = await runNexusAcceptCarriage({ handleIndex: 3, sealHome: sealHome() });
    expect(token.nym).toBe(await leafOf(3));
    const res = await direct(runNexusContract)({ action: "admit", nym: token.nym, contractSig: token.contractSig, sealHome: sealHome() });
    expect(res.contractIn).toBe("supplied");
    expect(res.memberHeld).toBe(true);
  });

  it("★ THE TWO FOLDS STAY TWO — a carry lands carrierHeld alone, an admit lands memberHeld alone ★", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));

    // The place signs its own carrier seal with its VESSEL key (this vessel stands in for the place).
    const seal  = await runNexusCarryFor({ sealHome: sealHome() });
    const carry = await direct(runNexusContract)({ action: "carry", nym: seal.nym, carrierSig: seal.carrierSig, sealHome: sealHome() });
    expect(carry.carrierHeld).toBe(true);
    expect(carry.memberHeld).toBe(false);

    // An admit after the carry, on the SAME board: the operator stands a member, never a carrier, and the
    // place stays out of the member set however the board is folded.
    const joinerNym = await leafOf(3);
    const admit = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    expect(admit.memberHeld).toBe(true);
    expect(admit.carrierHeld).toBe(false);
    expect((await direct(runNexusMembersList)({ sealHome: sealHome() })).members).not.toContain(seal.nym);
  });

  it("★ CARRY-FOR --nexus signs the seal and the floor pin at the NAMED Nexus, not the primary; an AID never carried refuses ★", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const primaryEpoch = await seatCharter(roots.map((r) => r.verifyingKey));
    // A second charter this vessel holds as a carried partner: other chairs, so another epoch and another AID.
    const other = heldCharter({ keys: (await seatChairs([4, 5, 6])).keys, threshold: 2 });
    const otherDoc = other.doc({ labels: ["Kahu Delta", "Kahu Epsilon", "Kahu Zeta"] });
    const otherAid = nexusAidOf(otherDoc)!;
    const primaryAid = nexusAidOf(readNexusDoc(sealHome()))!;
    expect(otherAid).not.toBe(primaryAid);
    writeNexusDoc(carriedCharterHome(sealHome(), otherAid), otherDoc);

    const primary = await runNexusCarryFor({ sealHome: sealHome() });
    expect(primary.sealEpochCid).toBe(primaryEpoch);
    const nexusHex = (aid: string): string => Buffer.from(aid, "utf8").toString("hex");
    expect(primary.floorPin!.pin.nexus).toBe(nexusHex(primaryAid));

    const named = await runNexusCarryFor({ sealHome: sealHome(), aid: otherAid });
    expect(named.sealEpochCid).toBe(other.head.epochCid);
    expect(named.sealEpochCid).not.toBe(primary.sealEpochCid);
    expect(named.floorPin!.pin.nexus).toBe(nexusHex(otherAid));
    // The primary named by its AID reads as the default does.
    expect((await runNexusCarryFor({ sealHome: sealHome(), aid: primaryAid })).sealEpochCid).toBe(primaryEpoch);
    // An AID this vessel holds no charter for refuses by name.
    await expect(runNexusCarryFor({ sealHome: sealHome(), aid: `nexus-${"ab".repeat(32)}` })).rejects.toThrow(NexusContractError);
  });

  it("REVOKE as a causal descendant drops membership", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const joinerNym = await leafOf(3);

    await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const rev = await direct(runNexusContract)({ action: "revoke", nym: joinerNym, sealHome: sealHome() });
    expect(rev.parents).toHaveLength(1);
    expect(rev.evidenceCid).toMatch(/^[0-9a-f]{64}$/);
    expect(rev.memberHeld).toBe(false);

    const list = await direct(runNexusMembersList)({ sealHome: sealHome() });
    expect(list.members).not.toContain(joinerNym);
  });

  it("★ ADMIT emits the CARRIED bundle — the entry, its lineage, the AID and this hearth's sovereign gate key; the take keeps it ★", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const joinerNym = await leafOf(3);

    const first = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const aid = nexusAidOf(readNexusDoc(sealHome()));
    expect(first.bundle).not.toBeNull();
    expect(first.bundle!.aid).toBe(aid);
    // The gate key is the hearth's SOVEREIGN gate's signing key for this Nexus (the admit repin), never the vessel's identity key.
    expect(first.bundle!.gatePubKey).toBe(hearthSovereignPin(aid!).signingKey.toLowerCase());
    expect(first.bundle!.gatePubKey).not.toBe((await loadVesselVerifyingKey()).toLowerCase());
    expect(carriageEntryActCid(first.bundle!.admit)).toBe(first.evidenceCid);
    expect(first.bundle!.lineage).toEqual([]);
    // Public bytes only: no seed and no secret rides the bundle. The pin's `signingKey` is the gate's PUBLIC verdict key,
    // the very key the bundle names as `gatePubKey`, and no private half of it appears anywhere.
    expect(JSON.stringify(first.bundle)).not.toMatch(/seed|secret|private/i);
    expect(first.bundle!.opening!.carriage.gatePin.signingKey).toBe(first.bundle!.gatePubKey);

    // A revoke emits none; the re-admit after it carries the admit and the revoke as its lineage.
    const rev = await direct(runNexusContract)({ action: "revoke", nym: joinerNym, sealHome: sealHome() });
    expect(rev.bundle).toBeNull();
    const again = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    expect(again.bundle!.lineage.map(carriageEntryActCid).sort()).toEqual([first.evidenceCid, rev.evidenceCid].sort());

    // The joinee's door (here the same vessel, which holds leaf 3): the take verifies offline and keeps it.
    const took = await takeAdmitBundle({ sealHome: sealHome(), raw: JSON.stringify(again.bundle) });
    expect(took.nym).toBe(joinerNym);
    expect(readKeptAdmitBundle(sealHome(), aid!)?.admit).toEqual(again.bundle!.admit);
  });

  it("does not parent a new act to policy-rejected same-nym evidence", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const joinerNym = await leafOf(3);

    const first = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const ownVesselKey = await loadVesselVerifyingKey();
    const repo = restingRepo(larDataDir());
    try {
      const handle = await materializeSharedLarDoc(
        repo,
        carriageDocUrl(nodeNexusIsland({ ownVesselKey, sealHome: sealHome() })),
        "board:carriage-contracts",
      );
      const rejected = await signCarriageQuorum(
        { nym: joinerNym, action: "revoke", parents: [first.evidenceCid], sealEpochCid: "wrong-local-epoch" },
        [{ signer: roots[0]!.verifyingKey, sign: ed25519SignerFromSeed(await loadPersonaGroupRootSeed(0)) }],
      );
      handle.change((draft) => writeCarriageEntry(draft, rejected));
      await repo.flush();
    } finally {
      await repo.flush().catch(() => { /* best effort */ });
    }

    const second = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    expect(second.parents).toEqual([first.evidenceCid]);
    expect(second.memberHeld).toBe(true);
  });

  it("SUB-QUORUM admit REFUSES (one held root against a 2-of-3 roster) — nothing written", async () => {
    await generateOrLoadVesselIdentity();
    const held = await generateOrLoadPersonaGroupRoot(0);
    const s1 = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(7)));
    const s2 = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(8)));
    const { keys: [heldChair] = [] } = await seatChairs([0]);
    const refusedRoster = heldCharter({ keys: [heldChair!, s1, s2], threshold: 2 });
    writeNexusDoc(sealHome(), refusedRoster.doc({ labels: ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"] }));
    const joiner = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(9)));

    const refused = direct(runNexusContract)({ action: "admit", nym: joiner, contractSig: "00".repeat(64), sealHome: sealHome() });
    await expect(refused).rejects.toBeInstanceOf(NexusContractError);
    // The shared selector refuses in THIS door's words: it names the membership act, never the antigen one.
    await expect(refused).rejects.toThrow(/holds 1 seat key\(s\).*valid membership act carries 2/);
    const list = await direct(runNexusMembersList)({ sealHome: sealHome() });
    expect(list.entries).toHaveLength(0);
  });

  it("UNSEATED charter REFUSES", async () => {
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    await expect(direct(runNexusContract)({ action: "admit", nym: "ab".repeat(32), contractSig: "00".repeat(64), sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusContractError);
  });

  it("admit for a NON-HELD nym with NO --contract REFUSES (no conscription — WAX-SEALS-ONLY)", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.map((r) => r.verifyingKey));
    const foreign = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(42)));   // not a held persona
    await expect(direct(runNexusContract)({ action: "admit", nym: foreign, sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusContractError);   // no contract-in obtainable → refuse
  });

  it("★ ONE ADDRESS — with a seal home passed, the admit write and the members list read the SAME board ★", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    expect(sealHome()).not.toBe(larSealHome());   // the passed home is NOT the default — the split's precondition
    const joinerNym = await leafOf(3);

    const res  = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const list = await direct(runNexusMembersList)({ sealHome: sealHome() });
    expect(list.island).toBe(nexusAidOf(readNexusDoc(sealHome())));   // the charter's island, not the vessel key
    expect(res.boardUrl).toBe(carriageDocUrl(list.island));
    expect(list.members).toContain(joinerNym);
  });

  it("CONTROL — the vessel's own-key board, where the list once read, holds none of the admit", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    await direct(runNexusContract)({ action: "admit", nym: await leafOf(3), sealHome: sealHome() });
    const ownKey = (await loadVesselVerifyingKey()).toLowerCase();
    const repo = restingRepo(larDataDir());
    try {
      const handle = await materializeSharedLarDoc(repo, carriageDocUrl(ownKey), "board:carriage-contracts");
      expect(carriageEntriesFromBoard(handle.doc())).toHaveLength(0);
    } finally {
      await repo.flush().catch(() => { /* best effort */ });
    }
  });

  it("★ a ROOT-nym admit with self-sign REFUSES — no held leaf matches a PersonaGroup root ★", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    await expect(direct(runNexusContract)({ action: "admit", nym: roots[3]!.verifyingKey, sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusContractError);
    expect((await direct(runNexusMembersList)({ sealHome: sealHome() })).entries).toHaveLength(0);
  });
});

describe("the subject stamps with its per-Nexus leaf — never its PersonaGroup root", () => {
  async function standKahu(): Promise<string[]> {
    await generateOrLoadVesselIdentity();
    await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));   // each face derives its leaf from its root
    return [...(await seatChairs([0, 1, 2])).keys];
  }

  it("★ one persona at two Nexus AIDs presents two nyms ★", async () => {
    const keys = await standKahu();
    await seatCharter(keys, 2);
    const atA = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    await seatCharter(keys, 3);                       // a different genesis — a different island
    const atB = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(atA.sealEpochCid).not.toBe(atB.sealEpochCid);
    expect(atA.nym).not.toBe(atB.nym);
  });

  it("★ one Nexus across a seal ROTATION keeps one nym — the AID is the genesis epoch ★", async () => {
    const keys = await standKahu();
    const successors = (await seatChairs([3, 4, 5], { generation: 1 })).keys;
    const genesis = heldCharter({ keys, threshold: 2, successors: { keys: successors, threshold: 2 } });
    writeNexusDoc(sealHome(), genesis.doc({ labels: chairs(keys) }));
    const before = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });

    const rotated = await genesis.roll(await heldHands(successors));
    writeNexusDoc(sealHome(), rotated.doc({ labels: chairs(keys) }));
    const after = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });

    expect(after.sealEpochCid).not.toBe(before.sealEpochCid);   // the frontier moved …
    expect(after.nym).toBe(before.nym);                         // … and the island kept its leaf
  });

  it("★ accept-carriage emits a nym signerClass reads as NEXUS-SCOPED: publishable, linking nothing ★", async () => {
    const keys = await standKahu();
    await seatCharter(keys);
    const token = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    const reading = signerClass(token.nym, {
      personaGroupRoots: keys, veiledHandles: [], vesselKeys: [await loadVesselVerifyingKey()],
      nexusScopedKeys: [await leafOf(0)],
    });
    expect(reading.klass).toBe("nexus-scoped");
    expect(reading.publishable).toBe(true);
    expect(reading.crossCircleLinkable).toBe(false);
  });

  it("★ a self-sign admit of a held persona lands the LEAF as the member ★", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const leaf = await leafOf(3);
    const res = await direct(runNexusContract)({ action: "admit", nym: leaf, sealHome: sealHome() });
    expect(res.contractIn).toBe("self");
    const list = await direct(runNexusMembersList)({ sealHome: sealHome() });
    expect(list.members).toContain(leaf);
    expect(list.members).not.toContain(roots[3]!.verifyingKey.toLowerCase());
  });
});

describe("the presented-admit gate — the sharePolicy member gate reads what a subject PRESENTS", () => {
  /** The member holder over the SAME store and board the admit wrote, as the boot stands it. */
  async function standHolder() {
    const ownVesselKey = await loadVesselVerifyingKey();
    const nexusPubkey = nodeNexusIsland({ ownVesselKey, sealHome: sealHome() });
    const repo = restingRepo(larDataDir());
    const open = async (url: Parameters<typeof materializeSharedLarDoc>[1], label: string) => (await materializeSharedLarDoc(repo, url, label)).doc();
    const holder = makeNexusMembership({
      sealHome: sealHome(), repo, nexusPubkey,
      readCarried: () => readCarriedNexuses({ sealHome: sealHome(), ownVesselKey, open }),
    });
    await holder.refold();
    return { holder, repo, nexusPubkey };
  }

  it("an admitted leaf that PRESENTS its admit with a leaf proof reads MEMBER; a seated kahu and the admitted nym presenting nothing read STRANGER", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const kahuNym   = roots[0]!.verifyingKey.toLowerCase();
    const joinerNym = await leafOf(3);
    await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });

    const { holder, repo, nexusPubkey } = await standHolder();
    try {
      // The joiner derives what it presents off a board it holds — here the same board the admit wrote.
      const board = (await materializeSharedLarDoc(repo, carriageDocUrl(nexusPubkey), "board:carriage-contracts")).doc();
      const { presentation: presented } = await presentationFromBoardDoc(board, joinerNym, foundingRoster(readNexusDoc(sealHome())));
      expect(presented).not.toBeNull();
      const aid = nexusAidOf(readNexusDoc(sealHome()))!;
      const leaf = await mintNexusLeaf(3, aid);
      await holder.present("peer-joiner", { presentedAdmit: { admit: presented!.admit, lineage: presented!.lineage }, faceKey: leaf.verifyingKey });
      await holder.present("peer-kahu", null);
      await holder.present("peer-wire-nym", null);

      expect(holder.membership.holdsCarriagePeer("peer-joiner")).toBe(true);   // presented, proven, held, carried
      expect(holder.leafNymOf("peer-joiner")).toBe(joinerNym);
      expect(holder.membership.holdsCarriagePeer("peer-kahu")).toBe(false);    // no kahu floor reads as member
      expect(holder.membership.holdsCarriagePeer("peer-wire-nym")).toBe(false); // no raw wire key reads as a nym
      void kahuNym;
    } finally { holder.dispose(); }
  });

  it("no-global-now — an EMPTY local replica (unsynced board, unseated charter) reads NOBODY member (fail-closed-stale)", async () => {
    await generateOrLoadVesselIdentity();
    await Promise.all([0, 1].map((i) => generateOrLoadPersonaGroupRoot(i)));
    // No seatCharter, no admit — the local replica is blank (as-of-a-sync-that-never-happened).
    const ownVesselKey = await loadVesselVerifyingKey();
    const repo = restingRepo(larDataDir());
    const open = async (url: Parameters<typeof materializeSharedLarDoc>[1], label: string) => (await materializeSharedLarDoc(repo, url, label)).doc();
    const holder = makeNexusMembership({ sealHome: sealHome(), repo, nexusPubkey: ownVesselKey,
      readCarried: () => readCarriedNexuses({ sealHome: sealHome(), ownVesselKey, open }) });
    await holder.refold();
    expect(holder.readings()).toEqual([]);                                     // no charter → no carried Nexus
    holder.dispose();
  });
});

describe("accept-carriage — this vessel keeps its own half of the relation", () => {
  // ── THE DEFECT THIS CLOSES, MEASURED IN DOCKER ────────────────────────────────────────────────
  // After a completed crossing the founder read `isNexus` and the joining operator read `seed`. The
  // phase counts operators THIS vessel admitted, which is an immune-surface fact and rightly local,
  // and a joiner admits nobody. Her evidence is the contract-in SHE signed — and `accept-carriage`
  // minted that signature, printed it for the founding kahu, and remembered nothing, so her vessel
  // could not tell itself it had joined anything.
  //
  // Canon: "a second OPERATOR is the first relation, and a Nexus IS the relation". A relation legible
  // from one side only is not one.

  /** Three seated kahu keys from this vessel's own vault — the founding shape every case here needs. */
  async function threeKeys(): Promise<string[]> {
    await generateOrLoadVesselIdentity();
    await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));   // each face derives its leaf from its root
    return [...(await seatChairs([0, 1, 2])).keys];
  }

  /** The AID of the charter standing at the primary path. */
  const primaryAid = (): string => nexusAidOf(readNexusDoc(sealHome()))!;

  /** A charter with a signed lineage that alternates its quorum between 2 and 3, so a rotation moves the head and keeps the AID. */
  async function seatLineage(keys: string[], rotations: number): Promise<void> {
    let seated = keys;
    let successors = (await seatChairs([3, 4, 5], { generation: 1 })).keys;
    let standing = heldCharter({ keys: seated, threshold: 2, successors: { keys: successors, threshold: 2 } });
    for (let i = 0; i < rotations; i++) {
      seated = successors;
      successors = (await seatChairs([3, 4, 5], { generation: i + 2 })).keys;
      standing = await standing.roll(await heldHands(seated), { keys: successors, threshold: 2 });
    }
    writeNexusDoc(sealHome(), standing.doc({ labels: chairs(seated) }));
  }

  it("★ a signed contract-in is KEPT per Nexus, bound to the epoch it consented under ★", async () => {
    const keys = await threeKeys();
    await seatCharter(keys);
    const r = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(r.aid).toBe(primaryAid());   // the AID defaults to the primary charter's
    const kept = readConsent(sealHome(), r.aid);
    expect(kept).not.toBeNull();
    expect(kept!.nym).toBe(r.nym);
    expect(kept!.sealEpochCid).toBe(r.sealEpochCid);
    expect(kept!.contractSig).toBe(r.contractSig);
    expect(existsSync(carriageConsentPathFor(sealHome(), r.aid))).toBe(true);
    expect(existsSync(join(sealHome(), "nexus", "carriage-consent.json"))).toBe(false);   // no single consent file
  });

  it("★ a vessel that consented reads that it CONTRACTED IN ★", async () => {
    const keys = await threeKeys();
    await seatCharter(keys);
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(true);
  });

  it("★ a vessel that consented to NOTHING says so ★", async () => {
    await seatCharter(await threeKeys());
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(false);
    expect(readConsent(sealHome(), primaryAid())).toBeNull();
  });

  it("★ a consent rooted BEHIND the standing head grants nothing — a rotation forces re-consent ★", async () => {
    // The load-bearing case. Carriage was accepted under one seal epoch; a rotation moves the head of the
    // SAME Nexus, and a kept consent must not carry a relation across terms it never read.
    const keys = await threeKeys();
    await seatLineage(keys, 0);
    const aid = primaryAid();
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(await hasContractedInto(sealHome(), aid)).toBe(true);

    await seatLineage(keys, 1);
    expect(primaryAid()).toBe(aid);                                // the same Nexus …
    expect(await hasContractedInto(sealHome(), aid)).toBe(false);  // … at a head the consent never read

    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(await hasContractedInto(sealHome(), aid)).toBe(true);
  });

  it("★ an UNSEATED charter carries no consent, however the record reads ★", async () => {
    const keys = await threeKeys();
    await seatCharter(keys);
    const aid = primaryAid();
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    writeNexusDoc(sealHome(), { ...emptyFoundingCharterDoc(), threshold: 2, kahu: [{ chairLabel: "Kahu Alpha", verifyingKey: null }] });
    expect(await hasContractedInto(sealHome(), aid)).toBe(false);
  });


  it("★ a PLANTED consent is refused — the file's location is not evidence ★", async () => {
    // Disk is not a trust boundary: `LAR_ROOT` names the whole seal home. A reading that trusted the
    // record's presence would report a Nexus this vessel never joined.
    const keys = await threeKeys();
    const epoch = await seatCharter(keys);
    writeConsent(sealHome(), primaryAid(), { nym: keys[0]!, sealEpochCid: epoch, contractSig: "00".repeat(64) });
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(false);
  });

  it("★ a genuine consent signed by this vessel's own ROOT is refused — the nym must be a held leaf ★", async () => {
    const keys = await threeKeys();
    const epoch = await seatCharter(keys);
    const root = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey.toLowerCase();
    const q = await signCarriageContract(root, epoch, ed25519SignerFromSeed(await loadPersonaGroupRootSeed(0)));
    const consent = { nym: root, sealEpochCid: epoch, contractSig: q.sig };
    expect(await verifyCarriageConsent(consent)).toBe(true);   // the seal is real …
    writeConsent(sealHome(), primaryAid(), consent);
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(false);   // … and names a root, which no stamp carries
  });

  it("★ ANOTHER operator's genuine consent is refused — the nym must be a leaf this vessel holds ★", async () => {
    // The half that verification alone misses. The seal is real; it just names somebody else's hand,
    // and copying it here would claim a relation another party entered.
    const keys = await threeKeys();
    const epoch = await seatCharter(keys);
    const foreignSeed = new Uint8Array(32).fill(9);
    const foreignNym  = Buffer.from(await ed.getPublicKeyAsync(foreignSeed)).toString("hex");
    const q = await signCarriageContract(foreignNym, epoch,
      async (b) => Buffer.from(await ed.signAsync(b, foreignSeed)).toString("hex"));
    writeConsent(sealHome(), primaryAid(), { nym: foreignNym, sealEpochCid: epoch, contractSig: q.sig });
    expect(await verifyCarriageConsent({ nym: foreignNym, sealEpochCid: epoch, contractSig: q.sig })).toBe(true);
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(false);
  });
});

describe("the rotate's ROLL ANCHOR carries an admit in its past across the seal roll", () => {
  /** A pre-rotated genesis over roots 0-2, armed with roots 4-6, and the roll that reveals them. */
  async function foundAndArm() {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3, 4, 5, 6].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const oldKeys = (await seatChairs([0, 1, 2])).keys;
    const newKeys = (await seatChairs([4, 5, 6], { generation: 1 })).keys;
    const genesis = heldCharter({ keys: oldKeys, threshold: 2, successors: { keys: newKeys, threshold: 2 } });
    writeNexusDoc(sealHome(), genesis.doc({ labels: chairs(oldKeys) }));
    const rolled = await genesis.roll((await seatChairs([4, 5, 6], { generation: 1 })).hands);
    const roll = (): void => writeNexusDoc(sealHome(), rolled.doc({ labels: chairs(newKeys) }));
    const opened = { keys: [...rolled.keys], threshold: rolled.threshold, sealEpochCid: rolled.head.epochCid };
    return { roots, e0: genesis.head, opened, roll };
  }

  async function boardNow() {
    const nexusPubkey = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: sealHome() });
    const repo = restingRepo(larDataDir());
    const doc = (await materializeSharedLarDoc(repo, carriageDocUrl(nexusPubkey), "board:carriage-contracts")).doc();
    await repo.flush();
    return { doc, entries: carriageEntriesFromBoard(doc), anchors: rollAnchorsFromBoard(doc) };
  }

  it("★ an admit in the anchor's past reads MEMBER at the new head; one minted after the anchor reads STRANGER ★", async () => {
    const { opened, roll } = await foundAndArm();
    const joinerNym = await leafOf(3);
    const aid = nexusAidOf(readNexusDoc(sealHome()))!;
    const admitted = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });

    const closing = foundingRoster(readNexusDoc(sealHome()));
    const landed = await direct(runNexusRollAnchor)({ sealHome: sealHome(), closing, opened });
    expect(landed.parents).toContain(admitted.evidenceCid);
    roll();
    expect(nexusAidOf(readNexusDoc(sealHome()))).toBe(aid);   // the AID survives the roll

    // AFTER the anchor, the CLOSED keys mint an admit at the closed epoch — it counts there, in no anchor's past.
    const lateNym = await leafOf(0);
    const lateQuorum = await Promise.all([0, 1].map(async (i) => ({
      signer: (await generateOrLoadPersonaGroupRoot(i)).verifyingKey, sign: ed25519SignerFromSeed(await loadPersonaGroupRootSeed(i)) })));
    const late = await signCarriageQuorum(
      { nym: lateNym, action: "admit", parents: [], sealEpochCid: closing.sealEpochCid }, lateQuorum,
      await signCarriageContract(lateNym, closing.sealEpochCid, ed25519SignerFromSeed((await mintNexusLeaf(0, aid)).seed)));
    {
      const nexusPubkey = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: sealHome() });
      const repo = restingRepo(larDataDir());
      const handle = await materializeSharedLarDoc(repo, carriageDocUrl(nexusPubkey), "board:carriage-contracts");
      handle.change((d) => writeCarriageEntry(d, late));
      await repo.flush();
    }

    const { doc: boardDoc, anchors } = await boardNow();
    expect(anchors.map(rollAnchorCid)).toEqual([landed.anchorCid]);
    const head = foundingRoster(readNexusDoc(sealHome()));
    const ownVesselKey = await loadVesselVerifyingKey();
    const repo = restingRepo(larDataDir());
    const open = async (url: Parameters<typeof materializeSharedLarDoc>[1], label: string) => (await materializeSharedLarDoc(repo, url, label)).doc();
    const holder = makeNexusMembership({ readCarried: () => readCarriedNexuses({ sealHome: sealHome(), ownVesselKey, open }) });
    try {
      await holder.refold();
      expect(holder.readings().map((r) => [r.via, r.sealLineage.length])).toEqual([["seat", 2]]);
      const presentAs = async (peer: string, nym: string, idx: number, strip = false, by?: AdmitPresentation) => {
        const p = by ?? (await presentationFromBoardDoc(boardDoc, nym, head)).presentation;
        expect(p).not.toBeNull();
        const lineage = strip ? p!.lineage.filter((e) => !isRollAnchor(e)) : p!.lineage;
        await holder.present(peer, { presentedAdmit: { admit: p!.admit, lineage }, faceKey: (await mintNexusLeaf(idx, aid)).verifyingKey });
      };
      await presentAs("peer-joiner", joinerNym, 3);
      await presentAs("peer-stripped", joinerNym, 3, true);
      // The presenter carries nothing it cannot carry: no anchor holds the late admit in its past.
      expect((await presentationFromBoardDoc(boardDoc, lateNym, head)).presentation).toBeNull();
      // Presented by hand through the anchor anyway, the verifier refuses it.
      await presentAs("peer-late", lateNym, 0, false, { admit: late, lineage: anchors });
      expect(holder.membership.holdsCarriagePeer("peer-joiner")).toBe(true);     // in the anchor's past → held
      expect(holder.membership.holdsCarriagePeer("peer-stripped")).toBe(false);  // CONTROL: no anchor → wrong-epoch
      expect(holder.membership.holdsCarriagePeer("peer-late")).toBe(false);      // CONTROL: after the anchor → wrong-epoch
    } finally { holder.dispose(); await repo.flush(); }
  });

  it("★ members --list reads an admit the anchor carries as MEMBER after the roll; one minted after the anchor stays off ★", async () => {
    const { opened, roll } = await foundAndArm();
    const joinerNym = await leafOf(3);
    const aid = nexusAidOf(readNexusDoc(sealHome()))!;
    await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const closing = foundingRoster(readNexusDoc(sealHome()));
    await direct(runNexusRollAnchor)({ sealHome: sealHome(), closing, opened });
    roll();

    // AFTER the anchor, the CLOSED keys mint an admit at the closed epoch: it counts there, in no anchor's past.
    const lateNym = await leafOf(0);
    const lateQuorum = await Promise.all([0, 1].map(async (i) => ({
      signer: (await generateOrLoadPersonaGroupRoot(i)).verifyingKey, sign: ed25519SignerFromSeed(await loadPersonaGroupRootSeed(i)) })));
    const late = await signCarriageQuorum(
      { nym: lateNym, action: "admit", parents: [], sealEpochCid: closing.sealEpochCid }, lateQuorum,
      await signCarriageContract(lateNym, closing.sealEpochCid, ed25519SignerFromSeed((await mintNexusLeaf(0, aid)).seed)));
    {
      const nexusPubkey = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: sealHome() });
      const repo = restingRepo(larDataDir());
      const handle = await materializeSharedLarDoc(repo, carriageDocUrl(nexusPubkey), "board:carriage-contracts");
      handle.change((d) => writeCarriageEntry(d, late));
      await repo.flush();
    }

    const list = await direct(runNexusMembersList)({ sealHome: sealHome() });
    expect(list.sealEpochCid).toBe(opened.sealEpochCid);   // the setup took: the list reads the rolled head
    expect(list.members).toContain(joinerNym.toLowerCase());
    expect(list.members).not.toContain(lateNym.toLowerCase());
  });

  it("★ a recogniser whose admit was minted BEFORE a roll still raises — raise-sign presents the anchor ★", async () => {
    const { opened, roll } = await foundAndArm();
    const aid = nexusAidOf(readNexusDoc(sealHome()))!;
    const recogniser = await leafOf(3);
    await direct(runNexusContract)({ action: "admit", nym: recogniser, sealHome: sealHome() });
    const challenge = mintRaiseChallenge({ vesselId: "ab".repeat(32), nexus: aid, epoch: 1, nonce: "56".repeat(16) });
    const challengeText = JSON.stringify(challenge);

    // CONTROL, before the roll: the admit sits at the head and raises.
    const { grant: before } = await direct(runRaiseSign)({ challengeText, handleIndex: 3, sealHome: sealHome() });
    expect(before.presentedAdmit.lineage.filter(isRollAnchor)).toEqual([]);

    const closing = foundingRoster(readNexusDoc(sealHome()));
    await direct(runNexusRollAnchor)({ sealHome: sealHome(), closing, opened });
    roll();

    // After the roll the admit roots on an ancestor epoch: the grant carries the anchor that carries it.
    const { grant, findings } = await direct(runRaiseSign)({ challengeText, handleIndex: 3, sealHome: sealHome() });
    expect(grant.byNym).toBe(recogniser);
    expect(grant.presentedAdmit.lineage.filter(isRollAnchor)).toHaveLength(1);
    expect(findings).toEqual([]);   // CONTROL: one anchor opens the head epoch — nothing to surface

    const ownVesselKey = await loadVesselVerifyingKey();
    const repo = restingRepo(larDataDir());
    try {
      const open = async (url: Parameters<typeof materializeSharedLarDoc>[1], label: string) => (await materializeSharedLarDoc(repo, url, label)).doc();
      const readings = await readCarriedNexuses({ sealHome: sealHome(), ownVesselKey, open });
      const verify = async (nym: string, bytes: Uint8Array, sig: string): Promise<boolean> =>
        ed.verifyAsync(Buffer.from(sig, "hex"), bytes, Buffer.from(nym, "hex"));
      expect(await verifyRaiseGrant({ grant, live: challenge, readings, verify })).toMatchObject({ ok: true });
      // CONTROL: the same grant with its anchor stripped refuses at the rolled head.
      const stripped = { ...grant, presentedAdmit: { ...grant.presentedAdmit, lineage: grant.presentedAdmit.lineage.filter((e) => !isRollAnchor(e)) } };
      expect(await verifyRaiseGrant({ grant: stripped, live: challenge, readings, verify })).toMatchObject({ ok: false, why: "wrong-epoch" });
    } finally { await repo.flush(); }
  });

  /** Land an ORPHAN anchor for the same roll by hand: the opened quorum signs it, and it cites no act this board holds. */
  async function landOrphanAnchor(closing: ReturnType<typeof foundingRoster>, opened: { keys: string[]; threshold: number; sealEpochCid: string }) {
    const orphan = await signRollAnchor(
      { prevEpochCid: closing.sealEpochCid, sealEpochCid: opened.sealEpochCid, prevKeys: closing.keys, prevThreshold: closing.threshold, parents: ["00".repeat(32)] },
      (await heldHands(opened.keys)).slice(0, opened.threshold),
    );
    const nexusPubkey = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: sealHome() });
    const repo = restingRepo(larDataDir());
    const handle = await materializeSharedLarDoc(repo, carriageDocUrl(nexusPubkey), "board:carriage-contracts");
    handle.change((d) => writeRollAnchor(d, orphan));
    await repo.flush();
    return orphan;
  }

  it("★ raise-sign surfaces two anchors opening one epoch beside the grant, and still signs ★", async () => {
    const { opened, roll } = await foundAndArm();
    const aid = nexusAidOf(readNexusDoc(sealHome()))!;
    await direct(runNexusContract)({ action: "admit", nym: await leafOf(3), sealHome: sealHome() });
    const closing = foundingRoster(readNexusDoc(sealHome()));
    const landed = await direct(runNexusRollAnchor)({ sealHome: sealHome(), closing, opened });
    const orphan = await landOrphanAnchor(closing, opened);
    roll();
    const challengeText = JSON.stringify(mintRaiseChallenge({ vesselId: "ab".repeat(32), nexus: aid, epoch: 1, nonce: "57".repeat(16) }));
    const { grant, findings } = await direct(runRaiseSign)({ challengeText, handleIndex: 3, sealHome: sealHome() });
    expect(grant.presentedAdmit.lineage.filter(isRollAnchor).map(rollAnchorCid)).toEqual([landed.anchorCid]);
    expect(findings).toEqual([{
      kind: "anchors-open-one-epoch", epochCid: opened.sealEpochCid, anchorCids: [landed.anchorCid, rollAnchorCid(orphan)].sort(),
    }]);
  });

  it("★ the contract signer at the head hears a fork that stands off its own walk ★", async () => {
    const { opened, roll } = await foundAndArm();
    const closing = foundingRoster(readNexusDoc(sealHome()));
    const landed = await direct(runNexusRollAnchor)({ sealHome: sealHome(), closing, opened });
    const orphan = await landOrphanAnchor(closing, opened);
    roll();
    // The admit this act signs lands at the head epoch, so its own presentation steps back through no anchor —
    // and the presenter still names the roll that landed twice below it, beside a bundle it never withholds.
    const res = await direct(runNexusContract)({ action: "admit", nym: await leafOf(3), sealHome: sealHome() });
    expect(res.bundle).not.toBeNull();
    expect(res.bundle!.lineage.filter(isRollAnchor)).toEqual([]);
    expect(res.findings).toEqual([{
      kind: "anchors-open-one-epoch", epochCid: opened.sealEpochCid, anchorCids: [landed.anchorCid, rollAnchorCid(orphan)].sort(),
    }]);
  });

  it("CONTROL: a roll that landed once leaves the contract signer nothing to hear", async () => {
    const { opened, roll } = await foundAndArm();
    await direct(runNexusRollAnchor)({ sealHome: sealHome(), closing: foundingRoster(readNexusDoc(sealHome())), opened });
    roll();
    const res = await direct(runNexusContract)({ action: "admit", nym: await leafOf(3), sealHome: sealHome() });
    expect(res.bundle).not.toBeNull();
    expect(res.findings).toEqual([]);
  });

  it("CONTROL: a roll whose NEW quorum this vessel does not hold REFUSES and lands no anchor, and the charter bytes stay untouched", async () => {
    const { opened } = await foundAndArm();
    const closing = foundingRoster(readNexusDoc(sealHome()));
    const foreign = { ...opened, keys: ["ab".repeat(32), "cd".repeat(32), "ef".repeat(32)] };
    const before = readFileSync(nexusCharterDocPath(sealHome()));
    await expect(direct(runNexusRollAnchor)({ sealHome: sealHome(), closing, opened: foreign })).rejects.toBeInstanceOf(NexusContractError);
    expect((await boardNow()).anchors).toEqual([]);
    // THE ROTATE-ANCHOR REFUSAL LEAVES CHARTER BYTES UNCHANGED — the rotate calls the anchor BEFORE it writes
    // the new head, precisely so a roll whose anchor cannot land writes nothing at all, not even the charter
    // doc itself (a separate file from the carriage board the anchor rides).
    expect(readFileSync(nexusCharterDocPath(sealHome()))).toEqual(before);
  });
});

describe("the door row — a held Repo, never a second opener", () => {
  /** Stand ONE live holder, a MessageChannel peer already syncing the board, and a 2-of-3 seated charter the
   *  held persona-roots satisfy. Mirrors `store-door-live.test.ts`'s WRITERS table for this file's own door. */
  async function standLiveAndPeer(): Promise<{
    live: Repo; peer: Repo; boardUrl: string; close: () => Promise<void>;
  }> {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const ownVesselKey = await loadVesselVerifyingKey();
    const boardUrl = carriageDocUrl(nodeNexusIsland({ ownVesselKey, sealHome: sealHome() }));
    const { port1, port2 } = new MessageChannel();
    const live = restingRepo(larDataDir(), {
      network: [new MessageChannelNetworkAdapter(port1)], sharePolicy: async () => true,
    });
    const peer = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], sharePolicy: async () => true });
    // The running vessel's replica and its peer's ALREADY hold the board before the write — a running vessel
    // never meets a cold board.
    await materializeSharedLarDoc(live, boardUrl, "board:carriage-contracts");
    await materializeSharedLarDoc(peer, boardUrl, "board:carriage-contracts");
    return {
      live, peer, boardUrl,
      close: async () => { await peer.shutdown().catch(() => {}); await live.rest(); port1.close(); port2.close(); },
    };
  }

  /** Wait until `read` finds what it looks for on the peer's own replica of `url` — no refresh, no restart. */
  async function peerSees(peer: Repo, url: string, read: (doc: unknown) => boolean): Promise<boolean> {
    const handle = await peer.find(url as Parameters<Repo["find"]>[0]);
    for (let i = 0; i < 100; i++) {
      if (read(handle.doc())) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }

  it("RED: runNexusContract (admit) over the held Repo reaches its live peer with no refresh", async () => {
    const { live, peer, boardUrl, close } = await standLiveAndPeer();
    try {
      const joinerNym = await leafOf(3);
      const res = await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome(), repo: live });
      expect(res.boardUrl).toBe(boardUrl);
      // NO second Repo opened, no flush-then-reopen cycle — the live holder's OWN write, seen by its OWN peer.
      expect(await peerSees(peer, boardUrl, (doc) => carriageEntriesFromBoard(doc as Parameters<typeof carriageEntriesFromBoard>[0]).some((e) => e.nym === joinerNym)),
        "the live peer never saw the admit").toBe(true);
      // MEMBERS-LIST READS HELD STATE: the SAME held repo, no new opener, reads the write at once.
      const list = await runNexusMembersList({ sealHome: sealHome(), repo: live });
      expect(list.members).toContain(joinerNym);
    } finally { await close(); }
  });

  it("RED: runNexusRollAnchor over the held Repo reaches its live peer with no refresh", async () => {
    const { live, peer, boardUrl, close } = await standLiveAndPeer();
    try {
      const joinerNym = await leafOf(3);
      await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome(), repo: live });
      const roster = foundingRoster(readNexusDoc(sealHome()));
      const landed = await runNexusRollAnchor({ sealHome: sealHome(), closing: roster, opened: roster, repo: live });
      expect(await peerSees(peer, boardUrl, (doc) => rollAnchorsFromBoard(doc as Parameters<typeof rollAnchorsFromBoard>[0]).some((a) => rollAnchorCid(a) === landed.anchorCid)),
        "the live peer never saw the roll anchor").toBe(true);
    } finally { await close(); }
  });

  it("CONTROL: with no vessel standing, the direct holder (ownedStore) writes the identical act to disk", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const joinerNym = await leafOf(3);
    // `direct()` holds the store for exactly this act (`ownedStore`), the same primitive `storeDoorDirect`
    // runs with no vessel standing — no live peer, no second opener, one direct holder.
    const res = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    expect(res.memberHeld).toBe(true);
    const list = await direct(runNexusMembersList)({ sealHome: sealHome() });
    expect(list.members).toContain(joinerNym);
  });
});

describe("a face's key at a Nexus mints at random and re-issues by a signed hand-over", () => {
  async function standHolderAt() {
    const ownVesselKey = await loadVesselVerifyingKey();
    const nexusPubkey = nodeNexusIsland({ ownVesselKey, sealHome: sealHome() });
    const repo = restingRepo(larDataDir());
    const open = async (url: Parameters<typeof materializeSharedLarDoc>[1], label: string) => (await materializeSharedLarDoc(repo, url, label)).doc();
    const holder = makeNexusMembership({ sealHome: sealHome(), repo, nexusPubkey, readCarried: () => readCarriedNexuses({ sealHome: sealHome(), ownVesselKey, open }) });
    await holder.refold();
    return { holder, repo, nexusPubkey };
  }
  async function presentUnder(holder: Awaited<ReturnType<typeof standHolderAt>>["holder"], repo: Repo, nexusPubkey: string, admitted: string, seed: Uint8Array, peer: string) {
    const board = (await materializeSharedLarDoc(repo, carriageDocUrl(nexusPubkey), "board:carriage-contracts")).doc();
    const { presentation } = await presentationFromBoardDoc(board, admitted, foundingRoster(readNexusDoc(sealHome())));
    await holder.present(peer, { presentedAdmit: { admit: presentation!.admit, lineage: presentation!.lineage }, faceKey: hex(await ed.getPublicKeyAsync(seed)) });
  }

  it("K8a RED: a read never mints — a held face holds no key at a Nexus until an act presents it; the act's key rests in the face's sealed cold row", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const aid = nexusAidOf(readNexusDoc(sealHome()))!;
    expect(await nexusLeafFor(3, aid)).toBeNull();
    expect((await heldNexusLeaves(aid)).map((l) => l.handleIndex)).toEqual([]);
    const minted = await mintNexusLeaf(3, aid);
    expect((await mintNexusLeaf(3, aid)).verifyingKey).toBe(minted.verifyingKey);           // a second act finds the first's key
    expect((await nexusLeafFor(3, aid))!.verifyingKey).toBe(minted.verifyingKey);
    expect(existsSync(handleRowPath(faceProofKeyFile(3, aid)))).toBe(true);
    expect(readFileSync(handleRowPath(faceProofKeyFile(3, aid))).includes(Buffer.from(minted.seed))).toBe(false); // sealed, never the clear bytes
  });

  it("K8b RED: two vessels whose face holds ONE root seed mint two unrelated keys at one Nexus — no seed derives a per-Nexus key", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const aid = nexusAidOf(readNexusDoc(sealHome()))!;
    const first = await mintNexusLeaf(3, aid);
    rmSync(handleRowPath(faceProofKeyFile(3, aid)));
    const second = await mintNexusLeaf(3, aid);                                              // the same root seed stands
    expect(second.verifyingKey).not.toBe(first.verifyingKey);
  });

  it("K8c the worn face re-issues: the gate stands the successor under the admitted nym, and the key it handed on proves nothing", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const aid = nexusAidOf(readNexusDoc(sealHome()))!;
    const joinerNym = await leafOf(3);
    const admitAct = await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const old = (await nexusLeafFor(3, aid))!;
    await wearPersona(3);
    let head = "";
    const { holder, repo, nexusPubkey } = await standHolderAt();
    try {
      const reissued = await runNexusKeyReissue({ sealHome: sealHome(), nexusAid: aid, repo });
      expect(reissued).toMatchObject({ nexusAid: aid, handleIndex: 3, from: joinerNym, admitted: joinerNym });
      const fresh = (await nexusLeafFor(3, aid))!;
      expect(fresh.verifyingKey).toBe(reissued.to);
      expect(fresh.verifyingKey).not.toBe(joinerNym);
      expect(readKeyLine(sealHome(), aid).map((r) => [r.from, r.to])).toEqual([[joinerNym, reissued.to]]);
      await holder.refold();
      await presentUnder(holder, repo, nexusPubkey, joinerNym, fresh.seed, "peer-successor");
      await presentUnder(holder, repo, nexusPubkey, joinerNym, old.seed, "peer-handed-on");
      expect(holder.membership.holdsCarriagePeer("peer-successor")).toBe(true);
      expect(holder.leafNymOf("peer-successor")).toBe(joinerNym);                            // the relation keeps its name
      expect(holder.membership.holdsCarriagePeer("peer-handed-on")).toBe(false);
      // A second re-issue starts from the head.
      const again = await runNexusKeyReissue({ sealHome: sealHome(), nexusAid: aid, repo });
      expect(again.from).toBe(reissued.to);
      expect(again.admitted).toBe(joinerNym);
      head = again.to;
      await repo.flush();
    } finally { holder.dispose(); }
    // The face's own admit bundle, taken after the re-issue: the held key is the admitted nym's successor.
    expect((await takeAdmitBundle({ sealHome: sealHome(), raw: JSON.stringify(admitAct.bundle) })).nym).toBe(joinerNym);
    // THE DIALER'S OWN SIDE: a raise signs under the head and presents the admit that names the admitted nym.
    const challenge = mintRaiseChallenge({ vesselId: "ab".repeat(32), nexus: aid, epoch: 1, nonce: "58".repeat(16) });
    const { grant } = await direct(runRaiseSign)({ challengeText: JSON.stringify(challenge), handleIndex: 3, sealHome: sealHome() });
    expect(grant.byNym).toBe(head);
    expect(grant.presentedAdmit.admit.nym).toBe(joinerNym);
  });

  it("K8d a re-issue that stopped before its hand-over landed resumes with the SAME successor; a refused one leaves the row as it stood", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const aid = nexusAidOf(readNexusDoc(sealHome()))!;
    const joinerNym = await leafOf(3);
    await wearPersona(3);
    const half = await beginNexusKeyReissue(3, aid);                                         // the process stops here
    expect((await nexusLeafFor(3, aid))!.verifyingKey).toBe(joinerNym);                     // the standing key still signs
    const repo = restingRepo(larDataDir());
    const resumed = await runNexusKeyReissue({ sealHome: sealHome(), nexusAid: aid, repo });
    expect(resumed.to).toBe(nexusKeyPublicOf(half.to));
    // A hand-over from the admitted key to a stranger already stands on the board: the line forks at the next try.
    const stranger = new Uint8Array(32).fill(99);
    const fork = await signNexusKeyHandOver({ nexus: aid, from: resumed.to, to: await ed.getPublicKeyAsync(stranger).then(hex) },
      ed25519SignerFromSeed((await nexusLeafFor(3, aid))!.seed), ed25519SignerFromSeed(stranger));
    const board = await materializeSharedLarDoc(repo, carriageDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: sealHome() })), "board:carriage-contracts");
    board.change((d) => writeNexusKeyHandOver(d, fork));
    const before = (await nexusLeafFor(3, aid))!.verifyingKey;
    await expect(runNexusKeyReissue({ sealHome: sealHome(), nexusAid: aid, repo })).rejects.toThrow(/already handed its standing on, or its line forks/);
    expect((await nexusLeafFor(3, aid))!.verifyingKey).toBe(before);
    await expect(listFaceProofKeys(3)).resolves.toHaveLength(1);                             // no half-done row left behind
  });

  it("K8e a re-issue that stopped after its hand-over landed, before the row closed, still presents: the dialer offers the successor, which heads the line", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const aid = nexusAidOf(readNexusDoc(sealHome()))!;
    const joinerNym = await leafOf(3);
    await direct(runNexusContract)({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const half = await beginNexusKeyReissue(3, aid);
    const record = await signNexusKeyHandOver({ nexus: aid, from: nexusKeyPublicOf(half.from), to: nexusKeyPublicOf(half.to) },
      ed25519SignerFromSeed(half.from), ed25519SignerFromSeed(half.to));
    keepKeyLine(sealHome(), aid, record);                                                    // the process stops before the row closes
    expect((await heldNexusLeaves(aid)).filter((l) => l.handleIndex === 3).map((l) => l.verifyingKey)).toEqual([joinerNym, nexusKeyPublicOf(half.to)]);
    const challenge = mintRaiseChallenge({ vesselId: "ab".repeat(32), nexus: aid, epoch: 1, nonce: "59".repeat(16) });
    const { grant } = await direct(runRaiseSign)({ challengeText: JSON.stringify(challenge), handleIndex: 3, sealHome: sealHome() });
    expect(grant.byNym).toBe(nexusKeyPublicOf(half.to));
    expect(grant.presentedAdmit.admit.nym).toBe(joinerNym);
  });
});

