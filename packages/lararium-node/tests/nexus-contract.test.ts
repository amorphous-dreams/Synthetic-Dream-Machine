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
 *     nothing, read STRANGER — the kahu floor and the board fold are retired from the consult,
 *   · USER-NEVER-WRITTEN: the board carries operator-pubkey nyms only,
 *   · ONE ADDRESS: with a seal home passed, the admit write and the members-list read key on the SAME island,
 *   · THE CARRIED ADMIT: an admit emits a bundle (entry · lineage · AID · this vessel's gate key) the joinee's
 *     take verifies offline and keeps; a revoke emits none.
 */
import { NEXUS_DOC_DOMAIN } from "@lararium/mesh";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { hex, genesisSealEpochCid, materializeSharedLarDoc, carriageDocUrl, carriageEntriesFromBoard, signCarriageQuorum, writeCarriageEntry, ed25519SignerFromSeed,
  deriveNexusScopedKey, realmIdOfCharter, signerClass, genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, PERSONA_GLAMOUR_CONTEXT,
  type NexusDoc } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { writeNexusDoc, readNexusDoc } from "../src/nexus-doc.js";
import { runNexusContract, runNexusAcceptCarriage, runNexusCarryFor, runNexusMembersList, NexusContractError,
  hasContractedInto } from "../src/commands/nexus-contract.js";
import { readConsent, writeConsent, carriageConsentPathFor } from "../src/carried-set.js";
import { signCarriageContract, verifyCarriageConsent } from "@lararium/mesh";
import { existsSync } from "node:fs";
import { larSealHome } from "../src/vessel-paths.js";
import { makeNexusMembership, readCarriedNexuses } from "../src/nexus-carriage.js";
import { nexusLeafFor } from "../src/nexus-leaf.js";
import { presentedAdmitFromBoard, signLeafProof, foundingRoster } from "@lararium/mesh";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { takeAdmitBundle, readKeptAdmitBundle } from "../src/admit-bundle.js";
import { carriageEntryActCid } from "@lararium/mesh";

let root: string;
let priorLarRoot: string | undefined;
const sealHome = (): string => join(root, "state", "nexus");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-admit-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  // Drain, then delete: a storage-backed Repo arms an uncancelable asyncThrottle (saveDebounceRate) trailing
  // save on materialize; a rmSync ahead of that timer draws an ENOENT unhandled rejection that bleeds across
  // the run. Wait past the debounce (deadline ≤ arm+100ms < this 200ms) so the write lands on a live dir.
  await new Promise((r) => setTimeout(r, 200));
  rmSync(root, { recursive: true, force: true });
});

/**
 * The per-Nexus leaf a held persona presents to the charter standing in the seal home — derived here
 * straight off the mesh primitive, so the expectation never borrows the code under test.
 */
async function leafOf(handleIndex: number): Promise<string> {
  const aid = realmIdOfCharter(readNexusDoc(sealHome()));
  if (!aid) throw new Error("no charter stands to derive a leaf for");
  const seed = await loadPersonaGroupRootSeed(handleIndex);
  return (await deriveNexusScopedKey(seed, handleIndex, PERSONA_GLAMOUR_CONTEXT, aid)).verifyingKey.toLowerCase();
}

function seatCharter(keys: string[], threshold = 2): void {
  const doc: NexusDoc = {
    kind: NEXUS_DOC_DOMAIN, threshold,
    sealEpochCid: genesisSealEpochCid(keys, threshold),
    kahu: [
      { displayName: "Kahu Alpha", verifyingKey: keys[0] ?? null },
      { displayName: "Kahu Beta",        verifyingKey: keys[1] ?? null },
      { displayName: "Kahu Gamma",        verifyingKey: keys[2] ?? null },
    ],
  };
  writeNexusDoc(sealHome(), doc);
}

describe("nexus admit — the RAISE side end-to-end (Build-2)", () => {
  it("ADMIT (self-contract) → board → fold → holdsCarriage: a 2-of-3 held-root admit contracts the operator", async () => {
    await generateOrLoadVesselIdentity();
    // The vessel holds 4 persona-roots: 0-2 are the founding kahu; 3 is the joining operator it self-contracts.
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const joinerNym = await leafOf(3);   // the persona's per-Nexus leaf, never its PersonaGroup root
    expect(joinerNym).not.toBe(roots[3]!.verifyingKey.toLowerCase());

    const res = await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    expect(res.nym).toBe(joinerNym);
    expect(res.parents).toEqual([]);
    expect(res.evidenceCid).toMatch(/^[0-9a-f]{64}$/);
    expect(res.signers).toHaveLength(2);       // exactly the 2-of-3 quorum
    expect(res.contractIn).toBe("self");       // multitude-of-one: the vessel held the joiner's seed
    expect(res.memberHeld).toBe(true);

    const list = await runNexusMembersList({ sealHome: sealHome() });
    expect(list.members).toContain(joinerNym);
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0]).toMatchObject({ nym: joinerNym, action: "admit", parents: [], signers: 2, contractIn: true });
  });

  it("accept-carriage → admit --contract: a joiner's out-of-band token admits it", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));

    // The joiner mints its 'accepts carriage' token (index 3 on this same vessel stands in for the joiner's vessel).
    const token = await runNexusAcceptCarriage({ handleIndex: 3, sealHome: sealHome() });
    expect(token.nym).toBe(await leafOf(3));
    const res = await runNexusContract({ action: "admit", nym: token.nym, contractSig: token.contractSig, sealHome: sealHome() });
    expect(res.contractIn).toBe("supplied");
    expect(res.memberHeld).toBe(true);
  });

  it("★ THE TWO FOLDS STAY TWO — a carry lands carrierHeld alone, an admit lands memberHeld alone ★", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));

    // The place signs its own carrier seal with its VESSEL key (this vessel stands in for the place).
    const seal  = await runNexusCarryFor({ sealHome: sealHome() });
    const carry = await runNexusContract({ action: "carry", nym: seal.nym, carrierSig: seal.carrierSig, sealHome: sealHome() });
    expect(carry.carrierHeld).toBe(true);
    expect(carry.memberHeld).toBe(false);

    // An admit after the carry, on the SAME board: the operator stands a member, never a carrier, and the
    // place stays out of the member set however the board is folded.
    const joinerNym = await leafOf(3);
    const admit = await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    expect(admit.memberHeld).toBe(true);
    expect(admit.carrierHeld).toBe(false);
    expect((await runNexusMembersList({ sealHome: sealHome() })).members).not.toContain(seal.nym);
  });

  it("REVOKE as a causal descendant drops membership", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const joinerNym = await leafOf(3);

    await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const rev = await runNexusContract({ action: "revoke", nym: joinerNym, sealHome: sealHome() });
    expect(rev.parents).toHaveLength(1);
    expect(rev.evidenceCid).toMatch(/^[0-9a-f]{64}$/);
    expect(rev.memberHeld).toBe(false);

    const list = await runNexusMembersList({ sealHome: sealHome() });
    expect(list.members).not.toContain(joinerNym);
  });

  it("★ ADMIT emits the CARRIED bundle — the entry, its lineage, the AID and this vessel's gate key; the take keeps it ★", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const joinerNym = await leafOf(3);

    const first = await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const aid = realmIdOfCharter(readNexusDoc(sealHome()));
    expect(first.bundle).not.toBeNull();
    expect(first.bundle!.aid).toBe(aid);
    expect(first.bundle!.gatePubKey).toBe((await loadVesselVerifyingKey()).toLowerCase());
    expect(carriageEntryActCid(first.bundle!.admit)).toBe(first.evidenceCid);
    expect(first.bundle!.lineage).toEqual([]);
    // Public bytes only: no seed, no signing key rides the bundle.
    expect(JSON.stringify(first.bundle)).not.toMatch(/seed|signingKey|secret/i);

    // A revoke emits none; the re-admit after it carries the admit and the revoke as its lineage.
    const rev = await runNexusContract({ action: "revoke", nym: joinerNym, sealHome: sealHome() });
    expect(rev.bundle).toBeNull();
    const again = await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    expect(again.bundle!.lineage.map(carriageEntryActCid).sort()).toEqual([first.evidenceCid, rev.evidenceCid].sort());

    // The joinee's door (here the same vessel, which holds leaf 3): the take verifies offline and keeps it.
    const took = await takeAdmitBundle({ sealHome: sealHome(), raw: JSON.stringify(again.bundle) });
    expect(took.nym).toBe(joinerNym);
    expect(readKeptAdmitBundle(sealHome(), aid!)?.admit).toEqual(again.bundle!.admit);
  });

  it("does not parent a new act to policy-rejected same-nym evidence", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const joinerNym = await leafOf(3);

    const first = await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const ownVesselKey = await loadVesselVerifyingKey();
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
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

    const second = await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    expect(second.parents).toEqual([first.evidenceCid]);
    expect(second.memberHeld).toBe(true);
  });

  it("SUB-QUORUM admit REFUSES (one held root against a 2-of-3 roster) — nothing written", async () => {
    await generateOrLoadVesselIdentity();
    const held = await generateOrLoadPersonaGroupRoot(0);
    const s1 = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(7)));
    const s2 = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(8)));
    seatCharter([held.verifyingKey, s1, s2]);
    const joiner = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(9)));

    const refused = runNexusContract({ action: "admit", nym: joiner, contractSig: "00".repeat(64), sealHome: sealHome() });
    await expect(refused).rejects.toBeInstanceOf(NexusContractError);
    // The shared selector refuses in THIS door's words: it names the membership act, never the antigen one.
    await expect(refused).rejects.toThrow(/holds 1 seated persona-root\(s\), but a valid membership act carries 2/);
    const list = await runNexusMembersList({ sealHome: sealHome() });
    expect(list.entries).toHaveLength(0);
  });

  it("UNSEATED charter REFUSES", async () => {
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    await expect(runNexusContract({ action: "admit", nym: "ab".repeat(32), contractSig: "00".repeat(64), sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusContractError);
  });

  it("admit for a NON-HELD nym with NO --contract REFUSES (no conscription — WAX-SEALS-ONLY)", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.map((r) => r.verifyingKey));
    const foreign = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(42)));   // not a held persona
    await expect(runNexusContract({ action: "admit", nym: foreign, sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusContractError);   // no contract-in obtainable → refuse
  });

  it("★ ONE ADDRESS — with a seal home passed, the admit write and the members list read the SAME board ★", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    expect(sealHome()).not.toBe(larSealHome());   // the passed home is NOT the default — the split's precondition
    const joinerNym = await leafOf(3);

    const res  = await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });
    const list = await runNexusMembersList({ sealHome: sealHome() });
    expect(list.island).toBe(realmIdOfCharter(readNexusDoc(sealHome())));   // the charter's island, not the vessel key
    expect(res.boardUrl).toBe(carriageDocUrl(list.island));
    expect(list.members).toContain(joinerNym);
  });

  it("CONTROL — the vessel's own-key board, where the list once read, holds none of the admit", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    await runNexusContract({ action: "admit", nym: await leafOf(3), sealHome: sealHome() });
    const ownKey = (await loadVesselVerifyingKey()).toLowerCase();
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
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
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    await expect(runNexusContract({ action: "admit", nym: roots[3]!.verifyingKey, sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusContractError);
    expect((await runNexusMembersList({ sealHome: sealHome() })).entries).toHaveLength(0);
  });
});

describe("the subject stamps with its per-Nexus leaf — never its PersonaGroup root", () => {
  async function standKahu(): Promise<string[]> {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    return roots.map((r) => r.verifyingKey);
  }

  it("★ one persona at two Nexus AIDs presents two nyms ★", async () => {
    const keys = await standKahu();
    seatCharter(keys, 2);
    const atA = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    seatCharter(keys, 3);                       // a different genesis — a different island
    const atB = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(atA.sealEpochCid).not.toBe(atB.sealEpochCid);
    expect(atA.nym).not.toBe(atB.nym);
  });

  it("★ one Nexus across a seal ROTATION keeps one nym — the AID is the genesis epoch ★", async () => {
    const keys = await standKahu();
    const genesis = genesisCharterEpoch(keys, 2, sealKeySetHash(keys, 3));
    const kahu = keys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k }));
    writeNexusDoc(sealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: genesis.epochCid, sealLineage: [genesis], kahu });
    const before = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });

    const rotated = rotateSealEpoch(genesis, keys, 3, sealKeySetHash(keys, 2));
    if (!rotated.ok) throw new Error(rotated.reason);
    writeNexusDoc(sealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 3, sealEpochCid: rotated.epoch.epochCid,
      sealLineage: [genesis, rotated.epoch], kahu });
    const after = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });

    expect(after.sealEpochCid).not.toBe(before.sealEpochCid);   // the frontier moved …
    expect(after.nym).toBe(before.nym);                         // … and the island kept its leaf
  });

  it("★ accept-carriage emits a nym signerClass reads as NEXUS-SCOPED: publishable, linking nothing ★", async () => {
    const keys = await standKahu();
    seatCharter(keys);
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
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const leaf = await leafOf(3);
    const res = await runNexusContract({ action: "admit", nym: leaf, sealHome: sealHome() });
    expect(res.contractIn).toBe("self");
    const list = await runNexusMembersList({ sealHome: sealHome() });
    expect(list.members).toContain(leaf);
    expect(list.members).not.toContain(roots[3]!.verifyingKey.toLowerCase());
  });
});

describe("the presented-admit gate — the sharePolicy member gate reads what a subject PRESENTS", () => {
  /** The member holder over the SAME store and board the admit wrote, as the boot stands it. */
  async function standHolder() {
    const ownVesselKey = await loadVesselVerifyingKey();
    const nexusPubkey = nodeNexusIsland({ ownVesselKey, sealHome: sealHome() });
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
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
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const kahuNym   = roots[0]!.verifyingKey.toLowerCase();
    const joinerNym = await leafOf(3);
    await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });

    const { holder, repo, nexusPubkey } = await standHolder();
    try {
      // The joiner derives what it presents off a board it holds — here the same board the admit wrote.
      const entries = carriageEntriesFromBoard((await materializeSharedLarDoc(repo, carriageDocUrl(nexusPubkey), "board:carriage-contracts")).doc());
      const presented = await presentedAdmitFromBoard(entries, joinerNym, foundingRoster(readNexusDoc(sealHome())));
      expect(presented).not.toBeNull();
      const aid = realmIdOfCharter(readNexusDoc(sealHome()))!;
      const leaf = await nexusLeafFor(3, aid);
      const nonce = "34".repeat(32);
      const gatePubKey = "ee".repeat(32);
      const vesselKey = "cd".repeat(32);
      const leafProof = await signLeafProof({ admit: presented!.admit, nonce, gatePubKey, vesselKey, sign: ed25519SignerFromSeed(leaf.seed) });
      await holder.present("peer-joiner", { presentedAdmit: { ...presented!, leafProof }, nonce, gatePubKey, vesselKey });
      await holder.present("peer-kahu", null);
      await holder.present("peer-wire-nym", null);

      expect(holder.membership.holdsCarriagePeer("peer-joiner")).toBe(true);   // presented, proven, held, carried
      expect(holder.leafNymOf("peer-joiner")).toBe(joinerNym);
      expect(holder.membership.holdsCarriagePeer("peer-kahu")).toBe(false);    // the kahu floor is RETIRED
      expect(holder.membership.holdsCarriagePeer("peer-wire-nym")).toBe(false); // no raw wire key reads as a nym
      void kahuNym;
    } finally { holder.dispose(); }
  });

  it("no-global-now — an EMPTY local replica (unsynced board, unseated charter) reads NOBODY member (fail-closed-stale)", async () => {
    await generateOrLoadVesselIdentity();
    await Promise.all([0, 1].map((i) => generateOrLoadPersonaGroupRoot(i)));
    // No seatCharter, no admit — the local replica is blank (as-of-a-sync-that-never-happened).
    const ownVesselKey = await loadVesselVerifyingKey();
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
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
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    return roots.map((r) => r.verifyingKey);
  }

  /** The AID of the charter standing at the primary path. */
  const primaryAid = (): string => realmIdOfCharter(readNexusDoc(sealHome()))!;

  /** A charter with a pre-rotated lineage, so a rotation moves the head and keeps the AID. */
  function seatLineage(keys: string[], rotations: number): void {
    const kahu = keys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k }));
    const lineage = [genesisCharterEpoch(keys, 2, sealKeySetHash(keys, 3))];
    let threshold = 2;
    for (let i = 0; i < rotations; i++) {
      const revealed = threshold === 2 ? 3 : 2;
      const r = rotateSealEpoch(lineage[lineage.length - 1]!, keys, revealed, sealKeySetHash(keys, threshold));
      if (!r.ok) throw new Error(r.reason);
      lineage.push(r.epoch);
      threshold = revealed;
    }
    writeNexusDoc(sealHome(), { kind: NEXUS_DOC_DOMAIN, threshold, sealEpochCid: lineage[lineage.length - 1]!.epochCid, sealLineage: lineage, kahu });
  }

  it("★ a signed contract-in is KEPT per Nexus, bound to the epoch it consented under ★", async () => {
    const keys = await threeKeys();
    seatCharter(keys);
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
    seatCharter(keys);
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(true);
  });

  it("★ a vessel that consented to NOTHING says so ★", async () => {
    seatCharter(await threeKeys());
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(false);
    expect(readConsent(sealHome(), primaryAid())).toBeNull();
  });

  it("★ a consent rooted BEHIND the standing head grants nothing — a rotation forces re-consent ★", async () => {
    // The load-bearing case. Carriage was accepted under one seal epoch; a rotation moves the head of the
    // SAME Nexus, and a kept consent must not carry a relation across terms it never read.
    const keys = await threeKeys();
    seatLineage(keys, 0);
    const aid = primaryAid();
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(await hasContractedInto(sealHome(), aid)).toBe(true);

    seatLineage(keys, 1);
    expect(primaryAid()).toBe(aid);                                // the same Nexus …
    expect(await hasContractedInto(sealHome(), aid)).toBe(false);  // … at a head the consent never read

    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(await hasContractedInto(sealHome(), aid)).toBe(true);
  });

  it("★ an UNSEATED charter carries no consent, however the record reads ★", async () => {
    const keys = await threeKeys();
    seatCharter(keys);
    const aid = primaryAid();
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    writeNexusDoc(sealHome(), {
      kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: null,
      kahu: [{ displayName: "Kahu Alpha", verifyingKey: null }],
    });
    expect(await hasContractedInto(sealHome(), aid)).toBe(false);
  });


  it("★ a PLANTED consent is refused — the file's location is not evidence ★", async () => {
    // Disk is not a trust boundary: `LAR_ROOT` names the whole seal home. A reading that trusted the
    // record's presence would report a Nexus this vessel never joined.
    const keys = await threeKeys();
    seatCharter(keys);
    const epoch = genesisSealEpochCid(keys, 2);
    writeConsent(sealHome(), primaryAid(), { nym: keys[0]!, sealEpochCid: epoch, contractSig: "00".repeat(64) });
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(false);
  });

  it("★ a genuine consent signed by this vessel's own ROOT is refused — the nym must be a held leaf ★", async () => {
    const keys = await threeKeys();
    seatCharter(keys);
    const epoch = genesisSealEpochCid(keys, 2);
    const q = await signCarriageContract(keys[0]!.toLowerCase(), epoch, ed25519SignerFromSeed(await loadPersonaGroupRootSeed(0)));
    const consent = { nym: keys[0]!.toLowerCase(), sealEpochCid: epoch, contractSig: q.sig };
    expect(await verifyCarriageConsent(consent)).toBe(true);   // the seal is real …
    writeConsent(sealHome(), primaryAid(), consent);
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(false);   // … and names a root, which no stamp carries
  });

  it("★ ANOTHER operator's genuine consent is refused — the nym must be a leaf this vessel holds ★", async () => {
    // The half that verification alone misses. The seal is real; it just names somebody else's hand,
    // and copying it here would claim a relation another party entered.
    const keys = await threeKeys();
    seatCharter(keys);
    const foreignSeed = new Uint8Array(32).fill(9);
    const foreignNym  = Buffer.from(await ed.getPublicKeyAsync(foreignSeed)).toString("hex");
    const q = await signCarriageContract(foreignNym, genesisSealEpochCid(keys, 2),
      async (b) => Buffer.from(await ed.signAsync(b, foreignSeed)).toString("hex"));
    writeConsent(sealHome(), primaryAid(), { nym: foreignNym, sealEpochCid: genesisSealEpochCid(keys, 2), contractSig: q.sig });
    expect(await verifyCarriageConsent({ nym: foreignNym, sealEpochCid: genesisSealEpochCid(keys, 2), contractSig: q.sig })).toBe(true);
    expect(await hasContractedInto(sealHome(), primaryAid())).toBe(false);
  });
});
