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
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  NEXUS_DOC_DOMAIN, genesisSealEpochCid, antigenEntriesFromBoard, edgeKapaeActsFromBoard, offeringAnnouncesFromDoc,
  verifiedVouchesFromBoard, hexToBytes, computePluginsCid, materializeSharedLarDoc, kapaeAntigenDocUrl,
  edgeKapaeBoardDocUrl, vouchBoardDocUrl, crossroadsDocUrl, GENESIS_CID_ENGINE_TIDDLER, GENESIS_CID_GRAMMAR_TIDDLER,
  GENESIS_CID_PLUGINS_TIDDLER, type NexusDoc, type LarDoc, type GenesisSeed, type RegionEntry,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, wearPersona, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { larDataDir } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { hearthDoorReactors, storeDoorDirect, type HearthDoorVerb } from "../src/hearth-door-verbs.js";
import { claimStore, StoreHeld } from "../src/owned-store.js";

let base: string;
let priorLarRoot: string | undefined;
const sealHome = (): string => join(process.env["LAR_ROOT"]!, "state", "nexus");
const at = (root: string): void => { process.env["LAR_ROOT"] = root; };

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "lares-door-live-"));
  priorLarRoot = process.env["LAR_ROOT"];
});
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  await new Promise((r) => setTimeout(r, 200));
  rmSync(base, { recursive: true, force: true });
});

const verify = (bytes: Uint8Array, sigHex: string, did: string) =>
  ed.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(did)).catch(() => false);

/** Seat a 2-of-3 charter whose kahu are this vessel's own held roots, wear h0, and seed a genesis plugin region. */
async function seatVessel(root: string): Promise<void> {
  at(root);
  await generateOrLoadVesselIdentity();
  const keys = (await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)))).map((r) => r.verifyingKey);
  const doc: NexusDoc = {
    kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2),
    kahu: keys.map((verifyingKey, i) => ({ displayName: `Kahu ${i}`, verifyingKey })),
  };
  writeNexusDoc(sealHome(), doc);
  await wearPersona(0);
  const genesisDir = join(root, "genesis");
  mkdirSync(genesisDir, { recursive: true });
  const plugin: RegionEntry = { id: "$:/plugins/example/one", sha256: "a".repeat(64), kind: "plugin" };
  const seed: GenesisSeed = {
    format: "lararium-genesis-seed/v1", actorSeed: "actor-seed", schemaVersion: "alpha",
    blobs: { [plugin.id]: { id: plugin.id, sha256: plugin.sha256, mimeType: "application/json", version: "local-alpha" } },
    tiddlers: {
      [GENESIS_CID_ENGINE_TIDDLER]: { tiddler: { cid: "e".repeat(64) } },
      [GENESIS_CID_GRAMMAR_TIDDLER]: { tiddler: { cid: "b".repeat(64) } },
      [GENESIS_CID_PLUGINS_TIDDLER]: { tiddler: { cid: computePluginsCid([plugin]) } },
    },
  } as GenesisSeed;
  writeFileSync(join(genesisDir, "seed.json"), JSON.stringify(seed));
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
  readonly verb: HearthDoorVerb;
  readonly args: Record<string, unknown>;
  /** The board the act lands on, by this vessel's island, and the label the vessel materializes it under. */
  readonly board: (island: string) => string;
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
    verb: "edge-kapae", args: { edgeId: "edge-" + "e".repeat(16), raised: true, epochCid: "epoch-one" },
    board: (i) => edgeKapaeBoardDocUrl(i), label: "board:edge-kapae",
    id: (o) => String(o["actCid"]),
    carries: (doc, id) => edgeKapaeActsFromBoard(doc).some((a) => a.actCid === id),
  },
  {
    verb: "cabal-vouch", args: { joiner: JOINER, realm: REALM, expiresAt: "2999-01-01T00:00:00Z" },
    board: (i) => vouchBoardDocUrl(i), label: "board:vouch-registry",
    // A vouch reports no content id of its own; its signature over the invite bytes names it.
    id: () => "",
    carries: async (doc) => (await vouchSigOf(doc)) !== undefined,
  },
  {
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

      // ── the twin stands a vessel: its Repo holds the store, a peer syncs it live ──
      at(twin);
      const { port1, port2 } = new MessageChannel();
      const live = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()), network: [new MessageChannelNetworkAdapter(port1)], sharePolicy: async () => true });
      const peer = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], sharePolicy: async () => true });
      let liveOut: Record<string, unknown>;
      let liveSig: string | undefined;
      try {
        // The running vessel already holds the board in its replica, and its peer already syncs it.
        const boardUrl = w.board(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey() }));
        await materializeSharedLarDoc(live, boardUrl as AutomergeUrl, w.label);
        await materializeSharedLarDoc(peer, boardUrl as AutomergeUrl, w.label);
        const doors = hearthDoorReactors({ storageDir: larDataDir(), sealHome: sealHome(), repo: live, dialGate: () => null });
        liveOut = await doors[w.verb](w.args, {} as never);
        expect(liveOut["refused"], String(liveOut["refused"])).toBeUndefined();
        const url = String(liveOut["boardUrl"]);
        expect(url).toBe(boardUrl);
        expect(await peerSees(peer, url, (doc) => w.carries(doc, w.id(liveOut))), `the live peer never saw the ${w.verb} act`).toBe(true);
        if (w.verb === "cabal-vouch") liveSig = await vouchSigOf((await live.find<LarDoc>(url as AutomergeUrl)).doc());
      } finally {
        await peer.shutdown().catch(() => {});
        await live.shutdown().catch(() => {});
        port1.close(); port2.close();
      }

      // ── the original stands none: the direct holder runs the same row ──
      at(original);
      const directOut = await storeDoorDirect(w.verb, w.args, { sealHome: sealHome() });
      expect(directOut["refused"], String(directOut["refused"])).toBeUndefined();
      expect(w.id(directOut)).toBe(w.id(liveOut));
      const reader = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
      try {
        const doc = (await reader.find<LarDoc>(String(directOut["boardUrl"]) as AutomergeUrl)).doc();
        expect(await w.carries(doc, w.id(directOut))).toBe(true);
        if (w.verb === "cabal-vouch") expect(await vouchSigOf(doc)).toBe(liveSig);
      } finally { await reader.shutdown().catch(() => {}); }
    }, 60_000);
  }

  it("RED: a direct holder refuses while a vessel stands on the store, and its row never runs", async () => {
    const root = join(base, "standing");
    await seatVessel(root);
    const standing = await claimStore(larDataDir());   // the vessel's rendezvous, bound
    try {
      await expect(storeDoorDirect("nexus-kapae", { action: "kapae", nym: "d".repeat(64) }, { sealHome: sealHome() }))
        .rejects.toBeInstanceOf(StoreHeld);
    } finally { await standing.release(); }
    // CONTROL: the vessel gone, the same row lands.
    const out = await storeDoorDirect("nexus-kapae", { action: "kapae", nym: "d".repeat(64) }, { sealHome: sealHome() });
    expect(out["refused"]).toBeUndefined();
    expect(String(out["actCid"])).toMatch(/./);
  });
});
