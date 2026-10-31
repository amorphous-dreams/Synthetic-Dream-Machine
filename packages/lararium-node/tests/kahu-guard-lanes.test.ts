/**
 * kahu-guard-lanes — THE LANES AROUND THE ONE GUARD close where trust was INFERRED FROM ABSENCE (road `P26`; controller
 * wider design ruling 2026-10-31 after Sol's guard read).
 *
 *   (1) IN-PROCESS GETS PROVEN, NEVER INFERRED. The composer read a peer as in-process wherever the listening server held no
 *       socket for it, so a peer on the outbound dial's own adapter skipped the guard and met the empty-relay-ring allow on
 *       both share hooks. The cure keeps a POSITIVE set per Repo of the peers that arrived on an adapter the vessel attached
 *       for its own islands (`islandPeersOf`); every other peer, on any adapter, takes the wire path, the guard first.
 *   (2) CLASSIFY OVER EVERY HOME. The collector read one primary charter home; a carried home's kept registration named a
 *       retained replica the guard never classed.
 *   (3) RECOUNT AT EVERY CLASSIFICATION WRITE. A later kept registration named an id outside the guard's snapshot.
 *
 *   L1m  MEASURE (Sol's path): under the old reading a dialed peer reads a private document and the canon.
 *   L1   RED: under the positive set the dialed peer draws withhold on the canon and denial on a private document.
 *   L1c  CONTROL: the vessel's own island still reads both.
 *   L2   RED: a carried home's kept registration classes its document; an ordinary member draws withhold.
 *   L3   RED: a kept registration written after the snapshot is withheld at once (the holder recounts on the write).
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo, interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import * as mesh from "@lararium/mesh";
import {
  LARES_DOC_URI, attachMessageChannelSync, emptyLarDoc, hex, protectedDocGuard, shareConfigOf, signRealmBagRegistration,
  type FederationGate, type LarDoc, type ProtectedDocClass,
} from "@lararium/mesh";
import * as kahuRealm from "../src/kahu-realm.js";
import { kahuProtectedDocIds } from "../src/kahu-realm.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";

vi.setConfig({ testTimeout: 60_000 });
const roots: string[] = [];
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });
const islandPeersOf = (mesh as unknown as { islandPeersOf?: (repo: Repo) => ReadonlySet<string> }).islandPeersOf;
type Holder = { ids(): ReadonlyMap<string, ProtectedDocClass>; recount(): Promise<void>; settled(): Promise<void>; close(): void };
const holderOf = (kahuRealm as unknown as { kahuProtectedHolder?: (o: { sealHome: string; canon: () => object }) => Holder }).kahuProtectedHolder;
const keepKahu = (kahuRealm as unknown as { keepKahuRegistration?: (sealHome: string, rec: unknown) => void }).keepKahuRegistration;
const deny: FederationGate = { mayFederate: async () => false };
const idOf = (url: string): string => String(interpretAsDocumentId(url as AutomergeUrl));

const settle = async <T,>(p: Promise<T>, ms: number): Promise<"ready" | "unavailable" | "timeout"> =>
  Promise.race([p.then(() => "ready" as const, () => "unavailable" as const), new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);

/** A sealed registration of `bag` at `nexus` naming `docUrl`, as a hearth keeps it. */
async function registration(nexus: string, docUrl: string, bag = LARES_DOC_URI) {
  const seed = new Uint8Array(32).fill(5);
  return signRealmBagRegistration({ realmId: nexus, bagUri: bag, docUrl, readTier: "contract" },
    [{ signer: hex(await ed.getPublicKeyAsync(seed)), sign: (b: Uint8Array) => ed.signAsync(b, seed).then(hex) }]);
}

/** A hearth Repo, one house island attached the composer's way, and one dialed peer on an adapter of its own. */
async function rig(inProcess: (repo: Repo, peerId: string) => boolean) {
  const canonIds = new Map<string, ProtectedDocClass>();
  let house!: Repo;
  const guard = protectedDocGuard({ ids: () => canonIds, decide: { "kahu-canon": () => false } });
  house = new Repo({
    network: [], peerId: "hearth" as PeerId,
    shareConfig: shareConfigOf(async (peerId, documentId) => {
      const wire = !inProcess(house, peerId);
      return selfSlotShareDecision({
        hasWsSocket: wire, peerClass: undefined, selfSlotFedGate: deny, antigenRing: null, membership: null, planeSeal: null,
        peerId, documentId: documentId as DocumentId | undefined, protectedDocs: guard,
      } as Parameters<typeof selfSlotShareDecision>[0]);
    }),
  });
  const canon = house.create<LarDoc>(emptyLarDoc());
  const priv = house.create<LarDoc>(emptyLarDoc());
  canonIds.set(String(canon.documentId), "kahu-canon");
  const isle = new MessageChannel();
  attachMessageChannelSync(house, isle.port1);
  const island = new Repo({ network: [new MessageChannelNetworkAdapter(isle.port2)], peerId: "own-island" as PeerId });
  const dial = new MessageChannel();
  house.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(dial.port1));     // the dial's own adapter
  const dialed = new Repo({ network: [new MessageChannelNetworkAdapter(dial.port2)], peerId: "dialed-hearth" as PeerId });
  await Promise.all([house, island, dialed].map((r) => r.networkSubsystem.whenReady()));
  await new Promise((r) => setTimeout(r, 200));
  const close = async () => { for (const p of [isle.port1, isle.port2, dial.port1, dial.port2]) p.close(); await Promise.allSettled([house, island, dialed].map((r) => r.shutdown())); };
  return { canon, priv, island, dialed, close };
}

describe("the lanes around the one guard", () => {
  test("L1m — MEASURE: under the old reading (no listening socket → in-process) a dialed peer reads a private document and the canon", async () => {
    const wsSockets = new Set<string>();                                       // the listening server holds no socket for a dialed peer
    const { canon, priv, dialed, close } = await rig((_repo, peerId) => !wsSockets.has(peerId));
    try {
      expect(await settle(dialed.find<LarDoc>(priv.url).then((h) => h.doc()), 3_000), "a private document").toBe("ready");
      expect(await settle(dialed.find<LarDoc>(canon.url).then((h) => h.doc()), 3_000), "the canon").toBe("ready");
    } finally { await close(); }
  });

  test("L1/L1c — under the positive set the dialed peer reads neither; the vessel's own island reads both", async () => {
    expect(typeof islandPeersOf, "islandPeersOf stands").toBe("function");
    const { canon, priv, island, dialed, close } = await rig((repo, peerId) => islandPeersOf!(repo).has(peerId));
    try {
      expect(await settle(dialed.find<LarDoc>(canon.url).then((h) => h.doc()), 3_000), "L1: the canon").toBe("unavailable");
      expect(await settle(dialed.find<LarDoc>(priv.url).then((h) => h.doc()), 3_000), "L1: a private document").toBe("unavailable");
      expect(await settle(island.find<LarDoc>(priv.url).then((h) => h.doc()), 3_000), "L1c: the own island").toBe("ready");
      expect(await settle(island.find<LarDoc>(canon.url).then((h) => h.doc()), 3_000), "L1c: the own island, canon").toBe("ready");
    } finally { await close(); }
  });

  test("L2 — a carried home's kept registration classes its document", async () => {
    const sealHome = mkdtempSync(join(tmpdir(), "lar-kahu-carried-")); roots.push(sealHome);
    const carried = "nexus-" + "c2".repeat(32);
    const doc = mesh.deterministicDocUrl("a-retained-carried-canon");
    const dir = join(sealHome, "carried", carried, "nexus", "kahu-realm", carried);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${encodeURIComponent(LARES_DOC_URI)}.json`), JSON.stringify(await registration(carried, doc)));
    const ids = await kahuProtectedDocIds({ sealHome });
    expect(ids.has(idOf(doc)), "the carried home's kept canon is classed").toBe(true);
  });

  test("L3 — a kept registration written after the snapshot is withheld at once", async () => {
    expect(typeof holderOf, "kahuProtectedHolder stands").toBe("function");
    expect(typeof keepKahu, "keepKahuRegistration stands").toBe("function");
    const sealHome = mkdtempSync(join(tmpdir(), "lar-kahu-fresh-")); roots.push(sealHome);
    const holder = holderOf!({ sealHome, canon: () => ({}) });
    try {
      await holder.recount();
      expect(holder.ids().size).toBe(0);
      const nexus = "nexus-" + "f3".repeat(32);
      const doc = mesh.deterministicDocUrl("a-later-kept-canon");
      keepKahu!(sealHome, await registration(nexus, doc));
      await holder.settled();
      expect(holder.ids().has(idOf(doc)), "the later kept canon is classed").toBe(true);
      const guard = protectedDocGuard({ ids: () => holder.ids(), decide: { "kahu-canon": () => false } });
      expect(await guard.withholds("member", idOf(doc))).toBe(true);
    } finally { holder.close(); }
  });
});
