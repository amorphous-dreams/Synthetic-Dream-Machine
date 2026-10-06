/**
 * nexus-contract.test.ts — the CONTRACT side of the operator MEMBERS-registry, end-to-end through the node
 * command, and the members{} ∪ kahu-floor UNION the sharePolicy member gate reads.
 *
 * Proven, against a SYNTHETIC seated roster on a temp LAR_ROOT (real vessel identity, real founder persona-roots,
 * a real Automerge board on disk):
 *   · the full loop ADMIT → board → read → fold → holdsCarriage — a 2-of-3 signed + contract-in admit lands on the
 *     always-carried members board and folds the operator nym to MEMBER (the a-multitude-of-one self-contract),
 *   · a causally-descendant REVOKE drops membership,
 *   · a SUB-QUORUM admit REFUSES (nothing written),
 *   · an UNSEATED charter REFUSES,
 *   · an admit for a nym the vessel does NOT hold, with NO --contract token, REFUSES (no conscription),
 *   · the members{} ∪ kahu-floor UNION: the makeNexusMembership holder reads BOTH a seated kahu AND an admitted
 *     non-kahu operator as MEMBER, off the SAME board the admit wrote (SELF-SLOT-B lit),
 *   · USER-NEVER-WRITTEN: the board carries operator-pubkey nyms only.
 */
import { NEXUS_DOC_DOMAIN } from "@lararium/mesh";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { hex, genesisSealEpochCid, materializeSharedLarDoc, carriageDocUrl, signCarriageQuorum, writeCarriageEntry, ed25519SignerFromSeed,
  deriveNexusScopedKey, realmIdOfCharter, signerClass, genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, PERSONA_GLAMOUR_CONTEXT,
  type NexusDoc } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { writeNexusDoc, readNexusDoc } from "../src/nexus-doc.js";
import { runNexusContract, runNexusAcceptCarriage, runNexusMembersList, NexusContractError,
  hasContractedInto, readCarriageConsent, carriageConsentPath } from "../src/commands/nexus-contract.js";
import { signCarriageContract, verifyCarriageConsent } from "@lararium/mesh";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { makeNexusMembership } from "../src/nexus-carriage.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";

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
        carriageDocUrl(nodeNexusIsland({ ownVesselKey })),
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

    await expect(runNexusContract({ action: "admit", nym: joiner, contractSig: "00".repeat(64), sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusContractError);
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

describe("the members{} ∪ kahu-floor UNION — the sharePolicy member gate (SELF-SLOT-B lit)", () => {
  it("the holder reads a seated kahu AND an admitted non-kahu operator as MEMBER (no-global-now: off the local replica)", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2, 3].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.slice(0, 3).map((r) => r.verifyingKey));
    const kahuNym   = roots[0]!.verifyingKey.toLowerCase();
    const joinerNym = await leafOf(3);

    // Contract-in + admit the non-kahu operator onto the board.
    await runNexusContract({ action: "admit", nym: joinerNym, sealHome: sealHome() });

    // Stand the membership holder over the SAME store (its own replica, as-of-last-sync) + the SAME board.
    const nexusPubkey = await loadVesselVerifyingKey();
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    const peerMap = new Map<string, string>([
      ["peer-kahu",   `prefix:${kahuNym}`],     // a seated kahu → MEMBER (the floor)
      ["peer-joiner", `prefix:${joinerNym}`],   // an admitted non-kahu operator → MEMBER (members{}) — SELF-SLOT-B
      ["peer-foreign", `prefix:${"ab".repeat(32)}`],  // never admitted → STRANGER
    ]);
    const holder = makeNexusMembership({ sealHome: sealHome(), peerIdentifierMap: peerMap, repo, nexusPubkey });
    await holder.refold();   // fold the members board atop the kahu floor

    expect(holder.membership.holdsCarriagePeer("peer-kahu")).toBe(true);      // kahu floor
    expect(holder.membership.holdsCarriagePeer("peer-joiner")).toBe(true);    // members{} — the light that flips SELF-SLOT-B
    expect(holder.membership.holdsCarriagePeer("peer-foreign")).toBe(false);  // fail-closed stranger
    holder.dispose();
  });

  it("no-global-now — an EMPTY local replica (unsynced board, unseated charter) reads NOBODY member (fail-closed-stale)", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1].map((i) => generateOrLoadPersonaGroupRoot(i)));
    // No seatCharter, no admit — the local replica is blank (as-of-a-sync-that-never-happened).
    const nexusPubkey = await loadVesselVerifyingKey();
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    const peerMap = new Map<string, string>([["peer-kahu", `prefix:${roots[0]!.verifyingKey.toLowerCase()}`]]);
    const holder = makeNexusMembership({ sealHome: sealHome(), peerIdentifierMap: peerMap, repo, nexusPubkey });
    await holder.refold();
    expect(holder.membership.holdsCarriagePeer("peer-kahu")).toBe(false);   // no charter, no board → nobody member
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

  it("★ a signed contract-in is KEPT, bound to the epoch it consented under ★", async () => {
    const keys = await threeKeys();
    seatCharter(keys);
    const r = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    const kept = readCarriageConsent(sealHome());
    expect(kept).not.toBeNull();
    expect(kept!.nym).toBe(r.nym);
    expect(kept!.sealEpochCid).toBe(r.sealEpochCid);
    expect(kept!.contractSig).toBe(r.contractSig);
  });

  it("★ a vessel that consented reads that it CONTRACTED IN ★", async () => {
    const keys = await threeKeys();
    seatCharter(keys);
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(await hasContractedInto(sealHome())).toBe(true);
  });

  it("★ a vessel that consented to NOTHING says so ★", async () => {
    seatCharter(await threeKeys());
    expect(await hasContractedInto(sealHome())).toBe(false);
    expect(readCarriageConsent(sealHome())).toBeNull();
  });

  it("★ a consent rooted BEHIND the standing epoch grants nothing — terms have moved ★", async () => {
    // The load-bearing case. Carriage was accepted under one charter epoch; a rotation moves the
    // frontier, and a kept consent must not carry a relation across terms it never read.
    const keys = await threeKeys();
    seatCharter(keys);
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    expect(await hasContractedInto(sealHome())).toBe(true);

    seatCharter(keys, 3);                       // a different charter epoch stands
    expect(await hasContractedInto(sealHome())).toBe(false);
  });

  it("★ an UNSEATED charter carries no consent, however the record reads ★", async () => {
    const keys = await threeKeys();
    seatCharter(keys);
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome() });
    writeNexusDoc(sealHome(), {
      kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: null,
      kahu: [{ displayName: "Kahu Alpha", verifyingKey: null }],
    });
    expect(await hasContractedInto(sealHome())).toBe(false);
  });


  it("★ a PLANTED consent is refused — the file's location is not evidence ★", async () => {
    // Disk is not a trust boundary: `LAR_ROOT` names the whole seal home. A reading that trusted the
    // record's presence would report a Nexus this vessel never joined.
    const keys = await threeKeys();
    seatCharter(keys);
    const epoch = genesisSealEpochCid(keys, 2);
    mkdirSync(dirname(carriageConsentPath(sealHome())), { recursive: true });
    writeFileSync(carriageConsentPath(sealHome()),
      JSON.stringify({ nym: keys[0], sealEpochCid: epoch, contractSig: "00".repeat(64) }), "utf8");
    expect(await hasContractedInto(sealHome())).toBe(false);
  });

  it("★ a genuine consent signed by this vessel's own ROOT is refused — the nym must be a held leaf ★", async () => {
    const keys = await threeKeys();
    seatCharter(keys);
    const epoch = genesisSealEpochCid(keys, 2);
    const q = await signCarriageContract(keys[0]!.toLowerCase(), epoch, ed25519SignerFromSeed(await loadPersonaGroupRootSeed(0)));
    const consent = { nym: keys[0]!.toLowerCase(), sealEpochCid: epoch, contractSig: q.sig };
    expect(await verifyCarriageConsent(consent)).toBe(true);   // the seal is real …
    mkdirSync(dirname(carriageConsentPath(sealHome())), { recursive: true });
    writeFileSync(carriageConsentPath(sealHome()), JSON.stringify(consent), "utf8");
    expect(await hasContractedInto(sealHome())).toBe(false);   // … and names a root, which no stamp carries
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
    mkdirSync(dirname(carriageConsentPath(sealHome())), { recursive: true });
    writeFileSync(carriageConsentPath(sealHome()),
      JSON.stringify({ nym: foreignNym, sealEpochCid: genesisSealEpochCid(keys, 2), contractSig: q.sig }), "utf8");
    expect(await verifyCarriageConsent({ nym: foreignNym, sealEpochCid: genesisSealEpochCid(keys, 2), contractSig: q.sig })).toBe(true);
    expect(await hasContractedInto(sealHome())).toBe(false);
  });
});
