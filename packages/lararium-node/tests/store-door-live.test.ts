/**
 * store-door-live — every store writer, routed through the door a standing vessel serves, lands on the replica
 * its peers sync; with no vessel standing, the same row lands the identical act through the direct holder.
 *
 * Proven, per writer (`nexus-kapae` · `edge-kapae` · `cabal-vouch` · `nexus-publish`):
 *   · RED: the row runs inside a "running vessel" — a Repo on the store that already holds the board in its
 *     replica, with a live peer joined by a MessageChannel and syncing that board — and the act reaches that
 *     peer with no refresh and no restart (a second opener's disk write never reaches a replica already held);
 *   · CONTROL: a copy of the same root, with no vessel standing, runs the same row through `storeDoorDirect`
 *     and lands the IDENTICAL act (same content id) on disk, where a later opener reads it;
 *   · a direct holder refuses while a vessel stands on the store.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { restEvery, restingRepo } from "./resting-repo.js";
import {
  antigenEntriesFromBoard, edgeKapaeActsFromBoard, offeringAnnouncesFromDoc,
  verifiedVouchesFromBoard, hexToBytes, hex, materializeSharedLarDoc, kapaeAntigenDocUrl, sha256HexBytesSync,
  fleetEdgeBoardDocUrl, realmVouchBoardDocUrl, crossroadsDocUrl, computePluginsCid, DAEMON_BAG_ID, seedDaemonDoc,
  GENESIS_CID_ENGINE_TIDDLER, GENESIS_CID_GRAMMAR_TIDDLER, GENESIS_CID_PLUGINS_TIDDLER,
  nexusAidOf, custodyRootDoor, deriveGateBundle, sovereignGateRoot, sovereignRoute, signCarriageQuorum, signCarriageContract, admitCarriageCommit, openAdmitCarriage, federationPostureFromDoc,
  type NexusDoc, type LarDoc, type GenesisSeed,
} from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, wearPersona, loadVesselVerifyingKey, loadPersonaGroupRootVerifyingKey,
  loadPersonaGroupRootSeed,
} from "../src/node-vessel-identity.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { larDataDir, larBootstrapPath } from "../src/vessel-paths.js";
import { writeNexusDoc, readNexusDoc } from "../src/nexus-doc.js";
import { mintNexusLeaf } from "../src/nexus-leaf.js";
import { admitBundlePathFor } from "../src/admit-bundle.js";
import { storeDoorReactors, storeDoorDirect, type StoreDoorVerb } from "../src/store-door-verbs.js";
import { claimStore, StoreHeld, ownedStore } from "../src/owned-store.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";
import { seedFaceAtom } from "./atom-fixture.js";
import { seedFleet } from "./fleet-seed-fixture.js";

let base: string;
let priorLarRoot: string | undefined;
const sealHome = (): string => join(process.env["LAR_ROOT"]!, "state", "nexus");
const at = (root: string): void => { process.env["LAR_ROOT"] = root; };

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "lares-door-live-"));
  priorLarRoot = process.env["LAR_ROOT"];
});
afterEach(async () => {
  // Every Repo this suite opened rests (its adapter closed) before the directory leaves: no save of theirs can land after.
  await restEvery();
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(base, { recursive: true, force: true });
});

const verify = (bytes: Uint8Array, sigHex: string, did: string) =>
  ed.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(did)).catch(() => false);

/** Seat a 2-of-3 charter whose kahu are this vessel's own held roots, wear h0, and seed a minimal,
 *  READABLE genesis (M-d: an absent genesis now refuses `boot-set-unknown` rather than failing
 *  open, so `nexus-publish`'s own writer test needs one; harmless for the other three writers). */
async function seatVessel(root: string): Promise<void> {
  at(root);
  mkdirSync(join(root, "genesis"), { recursive: true });
  const seed: GenesisSeed = {
    format: "lararium-genesis-seed/v1", actorSeed: "actor-seed",
    blobs: {},
    tiddlers: {
      [GENESIS_CID_ENGINE_TIDDLER]: { tiddler: { cid: "e".repeat(64) } },
      [GENESIS_CID_GRAMMAR_TIDDLER]: { tiddler: { cid: "b".repeat(64) } },
      [GENESIS_CID_PLUGINS_TIDDLER]: { tiddler: { cid: computePluginsCid([]) } },
    },
  };
  writeFileSync(join(root, "genesis", "seed.json"), JSON.stringify(seed));
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
  await Promise.all([0, 1, 2].map((i) => seedFaceAtom(i)));
  await seedFleet(0);
  const { keys } = await seatChairs([0, 1, 2]);
  const charter = heldCharter({ keys, threshold: 2 });
  const doc: NexusDoc = charter.doc({ labels: keys.map((_, i) => `Kahu ${i}`) });
  writeNexusDoc(sealHome(), doc);
  await wearPersona(0);
  // The worn face's key at this Nexus mints HERE, before a twin copies the root: a vouch signs with it, and the
  // twin and the original sign one act only while both hold the same random key.
  await mintNexusLeaf(0, nexusAidOf(doc)!);
  // §2.1 — `cabal-vouch`'s `resolveBoundEpoch` reads the social bootstrap for a daemon doc URL
  // (`daemonDocUrlFromBootstrap`) and refuses fail-closed when it finds none. Seed a REAL daemon doc +
  // the bootstrap pointer in the EXACT shape `runInit` writes (flat `tiddlers[DAEMON_BAG_ID].text`), so
  // `cabal-vouch`'s writer-test row reads a genesis (empty) fence rather than refusing "unreadable" —
  // this fixture exercises the LIVE-PEER proof, not the daemon-doc-unreadable path.
  await ownedStore(larDataDir(), async (repo) => {
    const handle = seedDaemonDoc(repo);
    await repo.flush();
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    const packedTiddlers = { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: handle.url, kind: "oracle" } };
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: packedTiddlers }) }), "utf8");
  });
}

/** An UNSIGNED offering source directory (H3, F2-3) — `offering.json` plus the one blob's bytes
 *  beside it. Lives OUTSIDE any vessel root (never `cpSync`'d between `original`/`twin`): both
 *  share it by path, so both derive the SAME `pluginsCid`/offeringCid from the SAME persona root. */
function offeringSourceDir(base: string): string {
  const dir = join(base, "offering-source");
  mkdirSync(dir, { recursive: true });
  const bytes = new TextEncoder().encode("good plugin bytes");
  const descriptor = {
    blobs: [{
      id: "$:/plugins/example/one", version: "local-alpha", sha256: sha256HexBytesSync(bytes),
      provenance: { source: "https://example.test/example-one", commit: "a".repeat(40), path: "plugins/example/one", licence: "MIT" },
      file: "plugin.bin",
    }],
  };
  writeFileSync(join(dir, "offering.json"), JSON.stringify(descriptor));
  writeFileSync(join(dir, "plugin.bin"), bytes);
  return dir;
}

/** Wait until `read` finds what it looks for on the peer's replica of `url`. */
async function peerSees(peer: Repo, url: string, read: (doc: LarDoc) => boolean | Promise<boolean>): Promise<boolean> {
  const handle = await peer.find<LarDoc>(url as AutomergeUrl);
  for (let i = 0; i < 100; i++) {
    if (await read(handle.doc())) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

/** What one writer is asked, and how its act reads back off a board. */
interface Writer {
  readonly verb: StoreDoorVerb;
  readonly args: Record<string, unknown>;
  /** The board the act lands on, by this vessel's island, and the label the vessel materializes it under. */
  /** The board the act lands on: keyed on the island, or (the fleet's edge board) on the vessel's first held root. */
  readonly board: (island: string, fleetRoot: string) => string;
  readonly label: string;
  /** The act's content id as the row reports it. */
  readonly id: (out: Record<string, unknown>) => string;
  /** Whether a board doc carries the act named `id`. */
  readonly carries: (doc: LarDoc, id: string) => boolean | Promise<boolean>;
}

const REALM = "a".repeat(64);
const JOINER = "b".repeat(64);
const vouchSigOf = async (doc: LarDoc): Promise<string | undefined> =>
  (await verifiedVouchesFromBoard(doc, REALM, verify)).find((v) => v.joinerIdentityHex === JOINER)?.sig;

const WRITERS: readonly Writer[] = [
  {
    verb: "nexus-kapae", args: { action: "kapae", nym: "d".repeat(64) },
    board: (i) => kapaeAntigenDocUrl(i), label: "board:kapae-antigen",
    id: (o) => String(o["actCid"]),
    carries: (doc, id) => antigenEntriesFromBoard(doc).some((e) => e.actCid === id),
  },
  {
    verb: "edge-kapae", args: { edgeId: "e".repeat(64), raised: true },
    board: (_island, fleetRoot) => fleetEdgeBoardDocUrl(fleetRoot), label: "board:edge-kapae",
    id: (o) => String(o["actCid"]),
    carries: (doc, id) => edgeKapaeActsFromBoard(doc).some((a) => a.actCid === id),
  },
  {
    verb: "cabal-vouch", args: { joiner: JOINER, realm: REALM },
    board: () => realmVouchBoardDocUrl(REALM), label: "board:vouch-registry",
    // A vouch reports no content id of its own; its signature over the invite bytes names it.
    id: () => "",
    carries: async (doc) => (await vouchSigOf(doc)) !== undefined,
  },
  {
    // `args.source` is filled in per-test (below) once `base` exists — the WRITERS table is built at
    // module scope, before any test's own scratch dir.
    verb: "nexus-publish", args: {},
    board: (i) => crossroadsDocUrl(i), label: "board:crossroads",
    id: (o) => String(o["offeringCid"]),
    carries: (doc, id) => offeringAnnouncesFromDoc(doc).some((a) => a.offeringCid === id),
  },
];

describe("the store door — a writer reaches the standing vessel's live peers", () => {
  for (const w of WRITERS) {
    it(`RED ${w.verb}: routed inside a running vessel, the act reaches its live peer with no refresh; CONTROL: the direct holder lands the identical act`, async () => {
      const original = join(base, "original");
      const twin = join(base, "twin");
      await seatVessel(original);
      cpSync(original, twin, { recursive: true });
      const source = offeringSourceDir(base);
      const args: Record<string, unknown> = w.verb === "nexus-publish" ? { ...w.args, source } : w.args;

      // ── the twin stands a vessel: its Repo holds the store, a peer syncs it live ──
      at(twin);
      const { port1, port2 } = new MessageChannel();
      const live = restingRepo(larDataDir(), { network: [new MessageChannelNetworkAdapter(port1)], sharePolicy: async () => true });
      const peer = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], sharePolicy: async () => true });
      let liveOut: Record<string, unknown>;
      let liveSig: string | undefined;
      try {
        // The running vessel already holds the board in its replica, and its peer already syncs it.
        const boardUrl = w.board(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey() }), (await loadPersonaGroupRootVerifyingKey(0)) ?? "");
        await materializeSharedLarDoc(live, boardUrl as AutomergeUrl, w.label);
        await materializeSharedLarDoc(peer, boardUrl as AutomergeUrl, w.label);
        const doors = storeDoorReactors({ storageDir: larDataDir(), sealHome: sealHome(), repo: live });
        liveOut = await doors[w.verb](args, {} as never);
        expect(liveOut["refused"], String(liveOut["refused"])).toBeUndefined();
        const url = String(liveOut["boardUrl"]);
        expect(url).toBe(boardUrl);
        expect(await peerSees(peer, url, (doc) => w.carries(doc, w.id(liveOut))), `the live peer never saw the ${w.verb} act`).toBe(true);
        if (w.verb === "cabal-vouch") liveSig = await vouchSigOf((await live.find<LarDoc>(url as AutomergeUrl)).doc());
      } finally {
        await peer.shutdown().catch(() => {});
        await live.rest();
        port1.close(); port2.close();
      }

      // ── the original stands none: the direct holder runs the same row ──
      at(original);
      const directOut = await storeDoorDirect(w.verb, args, { sealHome: sealHome() });
      expect(directOut["refused"], String(directOut["refused"])).toBeUndefined();
      expect(w.id(directOut)).toBe(w.id(liveOut));
      const reader = restingRepo(larDataDir());
      try {
        const doc = (await reader.find<LarDoc>(String(directOut["boardUrl"]) as AutomergeUrl)).doc();
        expect(await w.carries(doc, w.id(directOut))).toBe(true);
        if (w.verb === "cabal-vouch") expect(await vouchSigOf(doc)).toBe(liveSig);
      } finally { await reader.rest(); }
    }, 60_000);
  }

  it("RED: a direct holder refuses while a vessel stands on the store, and its row never runs", async () => {
    const root = join(base, "standing");
    await seatVessel(root);
    // The vessel's own claim, exactly as `prepareNodeBoot` takes it before its Repo opens (the boot itself is proven
    // holding it in e2e `boot-holds-the-store`).
    const standing = await claimStore(larDataDir(), { holder: "vessel" });
    try {
      await expect(storeDoorDirect("nexus-kapae", { action: "kapae", nym: "d".repeat(64) }, { sealHome: sealHome() }))
        .rejects.toBeInstanceOf(StoreHeld);
    } finally { await standing.release(); }
    // CONTROL: the vessel gone, the same row lands.
    const out = await storeDoorDirect("nexus-kapae", { action: "kapae", nym: "d".repeat(64) }, { sealHome: sealHome() });
    expect(out["refused"]).toBeUndefined();
    expect(String(out["actCid"])).toMatch(/./);
  });

  it("RED nexus-posture: a flip over a live Repo fires the after-roll hook once; CONTROL: a bare read fires it never", async () => {
    const root = join(base, "posture-root");
    await seatVessel(root);
    const live = restingRepo(larDataDir());
    const rolled: Array<string | undefined> = [];
    try {
      const doors = storeDoorReactors({
        storageDir: larDataDir(), sealHome: sealHome(), repo: live,
        onRolled: (aid) => { rolled.push(aid); },
      });
      // CONTROL first — a bare read never writes and never fires the hook.
      const read = await doors["nexus-posture"]({}, {} as never);
      expect(read["refused"]).toBeUndefined();
      expect(read["posture"]).toBe("private");
      expect(read["wrote"]).toBe(false);
      expect(rolled).toEqual([]);

      // RED — the flip writes the joint AND fires the hook exactly once.
      const flipped = await doors["nexus-posture"]({ want: "open" }, {} as never);
      expect(flipped["refused"]).toBeUndefined();
      expect(flipped["posture"]).toBe("open");
      expect(flipped["wrote"]).toBe(true);
      expect(rolled).toEqual([undefined]);
      expect(federationPostureFromDoc(readNexusDoc(sealHome()))).toBe("open");
    } finally { await live.rest(); }

    // CONTROL — `storeDoorDirect` (no vessel standing) writes the SAME joint with no hook to fire.
    const direct = await storeDoorDirect("nexus-posture", { want: "private" }, { sealHome: sealHome() });
    expect(direct["refused"]).toBeUndefined();
    expect(direct["posture"]).toBe("private");
    expect(federationPostureFromDoc(readNexusDoc(sealHome()))).toBe("private");
  });

  it("RED nexus-posture on a HERM: a place that lit no face refuses the flip by name and writes nothing; its read says OPEN by class", async () => {
    // A herm: a vessel key and a charter it imported, no persona root and no face anchors (operator ruling "A herm answers
    // the knock": OPEN by class, so the charter's posture joint governs nothing here).
    const root = join(base, "herm-root");
    at(root);
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    const { keys } = await seatChairs([0, 1, 2]);
    writeNexusDoc(sealHome(), heldCharter({ keys, threshold: 2 }).doc({ labels: keys.map((_, i) => `Kahu ${i}`) }));
    await expect(storeDoorDirect("nexus-posture", { want: "private" }, { sealHome: sealHome() })).rejects.toThrow(/answers the knock/);
    expect(readNexusDoc(sealHome())?.federationPosture).toBeUndefined();
    const read = await storeDoorDirect("nexus-posture", {}, { sealHome: sealHome() });
    expect(read["herm"]).toBe(true);
    expect(read["posture"]).toBe("open");
    expect(read["wrote"]).toBe(false);
  });

  it("RED nexus-admit-take: a taken bundle over a live Repo fires the after-roll hook and re-presents; CONTROL: direct keeps it with no hook", async () => {
    const root = join(base, "admit-take-root");
    await seatVessel(root);
    const doc = readNexusDoc(sealHome())!;
    const aidP = nexusAidOf(doc)!;
    // The held persona's OWN per-Nexus leaf (h0, the face `seatVessel` wears) — the multitude-of-one self-admit
    // `runNexusContract` mints in production, built here with the same pure mesh signers it uses.
    const leaf = await mintNexusLeaf(0, aidP);
    const sign = (seedBytes: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seedBytes).then(hex);
    const chairs = await seatChairs([0, 1, 2]);
    const quorum = chairs.hands.slice(0, 2);
    const consent = await signCarriageContract(leaf.verifyingKey, doc.sealEpochCid!, sign(leaf.seed));
    const pin = (() => {
      const bundle = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(3) })), new TextEncoder().encode(aidP), sovereignRoute("/ws"));
      try { return bundle.pin; } finally { bundle.drop(); }
    })();
    const opening = openAdmitCarriage({ gatePin: pin, canon: {} });
    const admit = await signCarriageQuorum({ nym: leaf.verifyingKey, action: "admit", parents: [], sealEpochCid: doc.sealEpochCid!,
      carriageCommit: admitCarriageCommit(opening) }, quorum, consent);
    const raw = JSON.stringify({ aid: aidP, gatePubKey: pin.signingKey, admit, lineage: [], opening });

    const live = restingRepo(larDataDir());
    const rolled: Array<string | undefined> = [];
    try {
      const doors = storeDoorReactors({
        storageDir: larDataDir(), sealHome: sealHome(), repo: live,
        // `represented` reads this hook's OWN claim (F2-1/H2): a fire-and-forget hook that merely EXISTS
        // reads false. Here the hook stands for the real `afterRoll`, which the fix made truthfully
        // report its own success — so this fixture claims it too, honestly, by returning `true`.
        onRolled: (aid) => { rolled.push(aid); return true; },
      });
      const out = await doors["nexus-admit-take"]({ raw }, {} as never);
      expect(out["refused"], String(out["refused"])).toBeUndefined();
      expect(out["aid"]).toBe(aidP);
      expect(out["represented"]).toBe(true);
      expect(rolled).toEqual([aidP]);
      expect(existsSync(admitBundlePathFor(sealHome(), aidP))).toBe(true);
    } finally { await live.rest(); }

    // CONTROL — `storeDoorDirect` (no vessel standing) keeps the identical bundle, `represented: false`, no hook.
    const direct = await storeDoorDirect("nexus-admit-take", { raw }, { sealHome: sealHome() });
    expect(direct["refused"]).toBeUndefined();
    expect(direct["represented"]).toBe(false);
  });
});
