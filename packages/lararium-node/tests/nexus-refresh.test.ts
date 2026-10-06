/**
 * nexus-refresh.test.ts — the LIVE-refold shore (D2 posture-flip + E2 out-of-process board write + the
 * per-Nexus deny-board refold).
 *
 * Proven:
 *   · PER CARRIED NEXUS — a revoke written out of process onto a carried Nexus's board is merged into the running
 *     Repo, the held presentation re-verifies against it and drops to STRANGER, and the report names that
 *     Nexus with its deny entries and held count (before: held 1; after: held 0).
 *   · POSTURE — an out-of-process `nexus posture open` disk write, then a refresh, reassigns the live posture
 *     (the setter fires with "open"); a torn/absent charter reads PRIVATE (fail-closed).
 *   · BOARD — a real 2-of-3 ban written through a SEPARATE repo on the same storage dir (the CLI's own repo)
 *     does NOT reach a holder standing on a cold board; a refresh re-materializes the board off storage and
 *     re-folds → the victim stands Kapae'd → carryContractShareDecision draws Mu for its peer.
 *   · the running holder's cached (empty) board proves the gap: WITHOUT the refresh the victim is not Kapae'd.
 */
import { NEXUS_DOC_DOMAIN } from "@lararium/mesh";
import { afterEach, beforeEach, describe, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  hex, signAntigenEntry, kapaeAntigenDocUrl, materializeSharedLarDoc, mutableLarRecord,
  genesisSealEpochCid, carryContractShareDecision,
  type KapaeAntigenEntry, type NexusDoc, type FederationPosture,
} from "@lararium/mesh";
import { makeAntigenRingHolder } from "../src/antigen-ring.js";
import { makeNexusMembership, readCarriedNexuses, liveBoardOpener } from "../src/nexus-carriage.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { runNexusRefresh } from "../src/nexus-refresh.js";

/**
 * Let any storage-backed Repo's armed trailing save land before the temp dir goes. Automerge's
 * StorageSource arms an asyncThrottle (saveDebounceRate, default 100ms) on every materialized doc;
 * neither repo.flush() nor repo.shutdown() cancels that armed timer. A refresh mints + disposes a
 * throwaway storage repo internally, so the test cannot reach that timer — it waits past the debounce
 * window (the timer's deadline ≤ arm+100ms strictly precedes this 200ms deadline, so the timer heap
 * fires it first even under worker starvation) so the trailing write lands on a LIVE dir. Drain, then delete.
 */
const drainStorageThrottle = (): Promise<void> => new Promise((r) => setTimeout(r, 200));

const SEEDS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const VICTIM_SEED = new Uint8Array(32).fill(9);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const NEXUS_PUBKEY = "a1b2c3d4e5f6a7b8";

function seatedCharter(keys: string[], posture?: FederationPosture): NexusDoc {
  const base: NexusDoc = {
    kind: NEXUS_DOC_DOMAIN, threshold: 2,
    sealEpochCid: genesisSealEpochCid(keys, 2),
    kahu: [
      { displayName: "Kahu Alpha", verifyingKey: keys[0]! },
      { displayName: "Kahu Beta",        verifyingKey: keys[1]! },
      { displayName: "Kahu Gamma",        verifyingKey: keys[2]! },
    ],
  };
  return posture ? { ...base, federationPosture: posture } : base;
}

async function banEntry(nym: string, epoch: string): Promise<KapaeAntigenEntry> {
  const signers = await Promise.all([SEEDS[0]!, SEEDS[1]!].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  return signAntigenEntry({ nym, action: "kapae", parents: [], sealEpochCid: epoch }, signers);
}

const OWN_VESSEL_KEY = "ab".repeat(32);

/** Stand the two live holders on a repo carrying NO storage — a cold in-memory board (the "just booted" state). */
function standHolders(bags: string) {
  const repo = new Repo({});
  const peerMap = new Map<string, string>();
  const antigen = makeAntigenRingHolder({ repo, nexusPubkey: NEXUS_PUBKEY, sealHome: bags, peerIdentifierMap: peerMap });
  let membership: ReturnType<typeof makeNexusMembership> | null = null;
  const boards = liveBoardOpener(repo, () => { void membership?.refold(); });
  membership = makeNexusMembership({
    sealHome: bags, repo, nexusPubkey: NEXUS_PUBKEY,
    readCarried: () => readCarriedNexuses({ sealHome: bags, ownVesselKey: OWN_VESSEL_KEY, open: boards.open }),
  });
  const deps = { repo, ownVesselKey: OWN_VESSEL_KEY };
  return { antigen, membership, peerMap, deps, dispose: () => { antigen.dispose(); membership?.dispose(); boards.dispose(); } };
}

describe("nexus-refresh — the own-board report names this vessel's own island", () => {
  let bags: string;
  let storage: string;
  beforeEach(() => { bags = mkdtempSync(join(tmpdir(), "lares-refresh-bags-")); storage = mkdtempSync(join(tmpdir(), "lares-refresh-store-")); });
  afterEach(async () => { await drainStorageThrottle(); rmSync(bags, { recursive: true, force: true }); rmSync(storage, { recursive: true, force: true }); });

  // ── WHY THIS IS PINNED ─────────────────────────────────────────────────────────────────────────
  // The own-board report names THIS vessel's island, and nothing in a charter a partner hands over can
  // redirect it. The carried Nexuses' boards the refresh also reads are DENY boards: only their counted
  // revokes reach the verdict, and an admit reaches the membership consult only as what its own subject
  // PRESENTS at the wire — so no partner's board can widen this vessel's carriage.

  test("★ a refresh reports this vessel's own island, so no caller assumes ★", async () => {
    const keys = await Promise.all(SEEDS.map(pubOf));
    const holders = standHolders(bags);
    try {
      writeNexusDoc(bags, seatedCharter(keys));
      const r = await runNexusRefresh({
        storageDir: storage, sealHome: bags, nexusPubkey: NEXUS_PUBKEY,
        ...holders.deps, antigen: holders.antigen, membership: holders.membership, setPosture: () => {},
      });
      expect(r.boardRoot).toBe(NEXUS_PUBKEY.toLowerCase());
    } finally { holders.dispose(); }
  });

  test("★ nothing in the charter can redirect the own-board report ★", async () => {
    // The charter is material a PARTNER hands over. If anything in it could name the board this
    // vessel folds, importing a charter would hand its author authority over this vessel's carry-split.
    const keys = await Promise.all(SEEDS.map(pubOf));
    const holders = standHolders(bags);
    try {
      writeNexusDoc(bags, { ...seatedCharter(keys), boardRoot: "f".repeat(64) } as never);
      const r = await runNexusRefresh({
        storageDir: storage, sealHome: bags, nexusPubkey: NEXUS_PUBKEY,
        ...holders.deps, antigen: holders.antigen, membership: holders.membership, setPosture: () => {},
      });
      expect(r.boardRoot).toBe(NEXUS_PUBKEY.toLowerCase());
    } finally { holders.dispose(); }
  });
});

describe("nexus-refresh — POSTURE re-read (D2)", () => {
  let bags: string;
  let storage: string;
  beforeEach(() => { bags = mkdtempSync(join(tmpdir(), "lares-refresh-bags-")); storage = mkdtempSync(join(tmpdir(), "lares-refresh-store-")); });
  afterEach(async () => { await drainStorageThrottle(); rmSync(bags, { recursive: true, force: true }); rmSync(storage, { recursive: true, force: true }); });

  test("an out-of-process posture flip to OPEN is picked up by a refresh (the setter fires with open)", async () => {
    const keys = await Promise.all(SEEDS.map(pubOf));
    const holders = standHolders(bags);
    let live: FederationPosture = "private";   // the live sharePolicy default, as the node boots it
    try {
      // The operator's `lares nexus posture open` rewrites the disk charter beside the running node.
      writeNexusDoc(bags, seatedCharter(keys, "open"));
      const r = await runNexusRefresh({
        storageDir: storage, sealHome: bags, nexusPubkey: NEXUS_PUBKEY,
        ...holders.deps, antigen: holders.antigen, membership: holders.membership, setPosture: (p) => { live = p; },
      });
      expect(r.posture).toBe("open");
      expect(live).toBe("open");   // the sharePolicy's live posture reassigned — no bounce
    } finally { holders.dispose(); }
  });

  test("FAIL CLOSED — an absent charter reads PRIVATE (a broken read only ever tightens)", async () => {
    const holders = standHolders(bags);
    let live: FederationPosture = "open";
    try {
      const r = await runNexusRefresh({
        storageDir: storage, sealHome: bags, nexusPubkey: NEXUS_PUBKEY,
        ...holders.deps, antigen: holders.antigen, membership: holders.membership, setPosture: (p) => { live = p; },
      });
      expect(r.posture).toBe("private");
      expect(live).toBe("private");
    } finally { holders.dispose(); }
  });
});

describe("nexus-refresh — out-of-process BOARD write (E2)", () => {
  let bags: string;
  let storage: string;
  beforeEach(() => { bags = mkdtempSync(join(tmpdir(), "lares-refresh-bags-")); storage = mkdtempSync(join(tmpdir(), "lares-refresh-store-")); });
  afterEach(async () => { await drainStorageThrottle(); rmSync(bags, { recursive: true, force: true }); rmSync(storage, { recursive: true, force: true }); });

  test("a ban written through a SEPARATE repo → cold holder misses it → refresh re-folds → Mu", async () => {
    const keys    = await Promise.all(SEEDS.map(pubOf));
    const victim  = await pubOf(VICTIM_SEED);
    const charter = seatedCharter(keys);
    writeNexusDoc(bags, charter);

    const holders = standHolders(bags);
    holders.peerMap.set("peer-victim", `prefix:${victim}`);
    try {
      // The running holder stood on a COLD board — the victim is NOT yet Kapae'd (the gap E2 names).
      await holders.antigen.refold();
      expect(holders.antigen.ring.kapaed.has(victim)).toBe(false);

      // The CLI writes the ban through its OWN repo on the SAME storage dir, then flushes (out-of-process shape).
      const writer = new Repo({ storage: new NodeFSStorageAdapter(storage) });
      const board  = await materializeSharedLarDoc(writer, kapaeAntigenDocUrl(NEXUS_PUBKEY), "board:kapae-antigen");
      const ban    = await banEntry(victim, charter.sealEpochCid!);
      board.change((d) => { d.tiddlers["ban:victim"] = mutableLarRecord("ban:victim", { text: JSON.stringify(ban) }, "test"); });
      await writer.flush();
      await writer.shutdown();   // dispose the CLI's throwaway writer whole — the ban bytes stay on disk, no repo lingers

      // The cold holder STILL misses it (its cached in-memory board never saw the out-of-process write).
      await holders.antigen.refold();
      expect(holders.antigen.ring.kapaed.has(victim)).toBe(false);

      // The refresh re-materializes the board off storage and re-folds → the victim now stands Kapae'd.
      const r = await runNexusRefresh({
        storageDir: storage, sealHome: bags, nexusPubkey: NEXUS_PUBKEY,
        ...holders.deps, antigen: holders.antigen, membership: holders.membership, setPosture: () => {},
      });
      expect(r.antigenEntries).toBe(1);
      expect(holders.antigen.ring.kapaed.has(victim)).toBe(true);

      // The presenter now draws Mu (the same `false` a caught-up peer draws) at the share decision.
      const noRelay = new Set<string>();
      expect(await carryContractShareDecision(noRelay, null, holders.antigen.ring, null, "peer-victim", undefined)).toBe(false);
    } finally { holders.dispose(); }
  });
});

// ── PER CARRIED NEXUS ──────────────────────────────────────────────────────────────────────────────────
import { signCarriageQuorum, signCarriageContract, signLeafProof, carriageEntryActCid, carriageDocUrl, writeCarriageEntry } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";

describe("nexus-refresh — the deny board of EVERY carried Nexus refolds, and the report names each", () => {
  let root: string;
  let storage: string;
  let prior: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-refresh-carried-"));
    storage = mkdtempSync(join(tmpdir(), "lares-refresh-carried-store-"));
    prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
  });
  afterEach(async () => {
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    await drainStorageThrottle();
    rmSync(root, { recursive: true, force: true });
    rmSync(storage, { recursive: true, force: true });
  });

  test("a revoke written out of process reaches the running replica; the held presentation drops; the report counts per N", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const keys  = roots.map((r) => r.verifyingKey);
    const bags  = join(root, "state", "nexus");
    const charter = seatedCharter(keys);
    writeNexusDoc(bags, charter);   // seated by this vessel's own roots → this Nexus stands in the carried set
    const ownVesselKey = await loadVesselVerifyingKey();
    const island = nodeNexusIsland({ ownVesselKey, sealHome: bags });
    const epoch  = charter.sealEpochCid!;

    // A joining operator's leaf, admitted by two of the seated roots.
    const leafSeed = new Uint8Array(32).fill(44);
    const leaf     = await pubOf(leafSeed);
    const quorum   = await Promise.all([0, 1].map(async (i) => ({ signer: keys[i]!, sign: signerOf(await loadPersonaGroupRootSeed(i)) })));
    const admit    = await signCarriageQuorum({ nym: leaf, action: "admit", parents: [], sealEpochCid: epoch }, quorum,
      await signCarriageContract(leaf, epoch, signerOf(leafSeed)));
    const revoke   = await signCarriageQuorum({ nym: leaf, action: "revoke", parents: [carriageEntryActCid(admit)], sealEpochCid: epoch }, quorum);

    const live = new Repo({});
    const antigen = makeAntigenRingHolder({ repo: live, nexusPubkey: island, sealHome: bags, peerIdentifierMap: new Map() });
    let membership: ReturnType<typeof makeNexusMembership> | null = null;
    const boards = liveBoardOpener(live, () => { void membership?.refold(); });
    membership = makeNexusMembership({
      sealHome: bags, repo: live, nexusPubkey: island,
      readCarried: () => readCarriedNexuses({ sealHome: bags, ownVesselKey, open: boards.open }),
    });
    const deps = { storageDir: storage, sealHome: bags, nexusPubkey: island, ownVesselKey, repo: live, antigen, membership, setPosture: () => {} };
    try {
      const gate = "ee".repeat(32);
      const nonce = "12".repeat(32);
      const vesselKey = await pubOf(new Uint8Array(32).fill(45));
      const leafProof = await signLeafProof({ admit, nonce, gatePubKey: gate, vesselKey, sign: signerOf(leafSeed) });
      await membership.refold();
      await membership.present("peer-b", { presentedAdmit: { admit, lineage: [], leafProof }, nonce, gatePubKey: gate, vesselKey });
      expect(membership.membership.holdsCarriagePeer("peer-b")).toBe(true);

      const before = await runNexusRefresh(deps);
      expect(before.nexuses).toHaveLength(1);
      expect(before.nexuses[0]).toMatchObject({ island, denyEntries: 0, held: 1 });

      // The kahu's revoke lands through the CLI's OWN repo on the same storage dir.
      const writer = new Repo({ storage: new NodeFSStorageAdapter(storage) });
      const board  = await materializeSharedLarDoc(writer, carriageDocUrl(island), "board:carriage-contracts");
      board.change((d) => writeCarriageEntry(d, revoke));
      await writer.flush();
      await writer.shutdown();

      // CONTROL: the running replica never saw the out-of-process write — the peer still stands.
      await membership.refold();
      expect(membership.membership.holdsCarriagePeer("peer-b")).toBe(true);

      const after = await runNexusRefresh(deps);
      expect(after.nexuses[0]).toMatchObject({ island, denyEntries: 1, held: 0 });
      expect(membership.membership.holdsCarriagePeer("peer-b")).toBe(false);
    } finally { antigen.dispose(); membership.dispose(); boards.dispose(); }
  });
});
