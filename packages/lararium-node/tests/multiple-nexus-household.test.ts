/**
 * multiple-nexus-household — two independent chartered Nexuses may share one immutable
 * genesis seed without sharing scope, boards, private documents, or causal state.
 *
 * This is the red-first composition proof for the household boundary. It stays on pure
 * identity, address, share-policy, Automerge, and FLOW projection seams; a live relay and
 * browser boot belong to the next boundary.
 */
import { describe, expect, test } from "vitest";
import { load } from "@automerge/automerge";
import { Repo, interpretAsDocumentId, stringifyAutomergeUrl, type BinaryDocumentId, type DocumentId } from "@automerge/automerge-repo";
import {
  DeterministicFederationGate,
  carriageDocUrl,
  crossroadsDocUrl,
  genesisCharterEpoch,
  kapaeAntigenDocUrl,
  materializeSharedLarDoc,
  nexusIdentity,
  nexusScopeOrThrow,
  personaKelBoardDocUrl,
  publicFlowMap,
  shareConfigOf,
  snapshotPublicFlowMap,
  whoBoardDocUrl,
  type GenesisSeed,
  type LarDoc,
} from "@lararium/mesh";
import { identityShareDecision } from "@lararium/mesh";
import { selfSlotShareDecision } from "../src/self-slot-share.js";

const SHARED_GENESIS_SEED: GenesisSeed = {
  format: "lararium-genesis-seed/v1",
  actorSeed: "11".repeat(32),
  schemaVersion: "0.1",
  blobs: {},
  tiddlers: {},
};

const NEXUS_A = genesisCharterEpoch(["aa".repeat(32)], 1, "").epochCid;
const NEXUS_B = genesisCharterEpoch(["bb".repeat(32)], 1, "").epochCid;
const VESSEL_A = "a1".repeat(32);
const VESSEL_B = "b1".repeat(32);
const LEAF_B = "c1".repeat(32);
const RELAY_A = "relay-transport-a";

const boardUrls = (scope: string): readonly string[] => [
  crossroadsDocUrl(scope),
  whoBoardDocUrl(scope),
  carriageDocUrl(scope),
  kapaeAntigenDocUrl(scope),
  personaKelBoardDocUrl(scope),
];

const docIdOf = (url: string): DocumentId =>
  interpretAsDocumentId(url as never) as DocumentId;

const privateDoc = (tag: string): DocumentId =>
  docIdOf(stringifyAutomergeUrl({ documentId: new Uint8Array(16).fill(tag.length) as BinaryDocumentId }));

describe("multiple-Nexus household proof", () => {
  test("one GenesisSeed may found independent Nexuses with distinct identity and every board address", () => {
    // The immutable substrate is shared byte-for-byte; the charter epoch is the Nexus name.
    const seedA = SHARED_GENESIS_SEED;
    const seedB = SHARED_GENESIS_SEED;
    expect(seedA).toBe(seedB);
    expect(NEXUS_A).not.toBe(NEXUS_B);

    const a = nexusIdentity({ genesisEpochCid: NEXUS_A, charterStands: true, ownVesselKey: VESSEL_A });
    const b = nexusIdentity({ genesisEpochCid: NEXUS_B, charterStands: true, ownVesselKey: VESSEL_B });
    expect(nexusScopeOrThrow(a)).toBe(NEXUS_A);
    expect(nexusScopeOrThrow(b)).toBe(NEXUS_B);
    expect(a.scope).not.toBe(b.scope);

    const aBoards = boardUrls(nexusScopeOrThrow(a));
    const bBoards = boardUrls(nexusScopeOrThrow(b));
    expect(new Set(aBoards)).toHaveLength(5);
    expect(new Set(bBoards)).toHaveLength(5);
    for (const url of aBoards) expect(bBoards).not.toContain(url);
    for (const vesselKey of [VESSEL_A, VESSEL_B]) {
      expect(aBoards.join("\n")).not.toContain(vesselKey);
      expect(bBoards.join("\n")).not.toContain(vesselKey);
    }
  });

  test("a Nexus gate is scoped: A admits A's public boards and denies B's boards and private docs", async () => {
    const gateA = new DeterministicFederationGate(NEXUS_A);
    const aBoards = boardUrls(NEXUS_A).map(docIdOf);
    const bBoards = boardUrls(NEXUS_B).map(docIdOf);
    const privateA = privateDoc("A");

    for (const documentId of aBoards) {
      expect(await selfSlotShareDecision({
        hasWsSocket: true, peerClass: "cross-operator", selfSlotFedGate: gateA,
        antigenRing: null, membership: null, planeSeal: null, peerId: "foreign-peer", documentId,
      })).toBe(true);
    }
    for (const documentId of [...bBoards, privateA]) {
      // This assertion is the mutation pin: replacing the gate with `() => true` must turn red.
      expect(await selfSlotShareDecision({
        hasWsSocket: true, peerClass: "cross-operator", selfSlotFedGate: gateA,
        antigenRing: null, membership: null, planeSeal: null, peerId: "foreign-peer", documentId,
      })).toBe(false);
    }
  });

  test("a browser leaf may hold B while dialing A, but both share hooks deny A private state", async () => {
    const leaf = nexusIdentity({
      genesisEpochCid: NEXUS_B,
      charterStands: true,
      anchorGateKey: NEXUS_A,
      anchorStands: true,
      ownVesselKey: LEAF_B,
    });
    expect(nexusScopeOrThrow(leaf)).toBe(NEXUS_B); // charter scope outranks transport reachability

    const gateB = new DeterministicFederationGate(NEXUS_B);
    const bBoard = docIdOf(crossroadsDocUrl(NEXUS_B));
    const aBoard = docIdOf(crossroadsDocUrl(NEXUS_A));
    const aPrivate = privateDoc("A-private");
    // This is the browserShareConfig composition: one identity verdict is seated on announce AND access.
    const browserShare = shareConfigOf((peerId, documentId) =>
      identityShareDecision(new Set([RELAY_A]), gateB, null, peerId, documentId));

    for (const hook of [browserShare.announce, browserShare.access]) {
      expect(await hook(RELAY_A as never, bBoard)).toBe(true);
      expect(await hook(RELAY_A as never, aBoard)).toBe(false);
      expect(await hook(RELAY_A as never, aPrivate)).toBe(false);
    }
  });

  test("B's causal board state remains local when A is absent", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const bBoard = await materializeSharedLarDoc(repo, crossroadsDocUrl(NEXUS_B), "board:crossroads");
    bBoard.change((doc) => {
      doc.tiddlers["lar:///household/b-state"] = {
        title: "lar:///household/b-state",
        text: "B-local-causal-state",
      };
    });
    const before = bBoard.doc()?.tiddlers["lar:///household/b-state"];
    expect(before?.text).toBe("B-local-causal-state");

    // No A board is materialized or merged. The foreign absence is an explicit denied read.
    const gateB = new DeterministicFederationGate(NEXUS_B);
    expect(await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "cross-operator", selfSlotFedGate: gateB,
      antigenRing: null, membership: null, planeSeal: null, peerId: RELAY_A, documentId: docIdOf(crossroadsDocUrl(NEXUS_A)),
    })).toBe(false);
    expect(bBoard.doc()?.tiddlers["lar:///household/b-state"]?.text).toBe("B-local-causal-state");
    await repo.shutdown();
  });

  test("FLOW remains a separate public projection: coarse public routes cross, private territory does not", async () => {
    const flowDoc: LarDoc = {
      schemaVersion: "0.1",
      tiddlers: {
        "public-dial": { tiddler: { title: "public-dial", kind: "dial", scale: "nexus", endpoint: "ws://relay-a" } },
        "private-dial": { tiddler: { title: "private-dial", kind: "dial", endpoint: "ws://local-b" } },
        "private-cap": { tiddler: { title: "private-cap", kind: "cap", cap: "tuber.store" } },
      },
    };
    const projection = publicFlowMap(flowDoc);
    expect(Object.keys(projection.tiddlers)).toEqual(["public-dial"]);
    const snapshot = await snapshotPublicFlowMap(flowDoc);
    const materialized = load<Record<string, unknown>>(snapshot.bytes);
    expect(Object.keys((materialized as unknown as LarDoc).tiddlers)).toEqual(["public-dial"]);
  });
});
