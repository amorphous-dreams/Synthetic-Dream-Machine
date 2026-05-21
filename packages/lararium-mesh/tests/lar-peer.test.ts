/**
 * LarPeer — causal island peer contracts.
 *
 * LarPeer holds no content truth. It receives the assembled CompositeStore
 * (system → corpus:* → room → draft) from the factory. Server and browser
 * peers share the same class — capability presets encode the environmental
 * difference.
 *
 * Meme: lar:///ha.ka.ba/@lares/api/v0.1/lararium/lar-peer
 */

import { describe, test, expect } from "vitest";
import {
  LarPeer,
  PEER_CAPABILITIES_NODE,
  PEER_CAPABILITIES_BROWSER,
  PEER_CAPABILITIES_NONE,
  type OperatorPeerOpenOptions,
  type OperatorPeerOpenResult,
  OpenIdentitySlot,
  CompositeStore,
  BAG_IDS,
} from "../src/index.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import type { LarTiddlerChange } from "../src/tiddler-store.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStore(): CompositeStore {
  const store = new CompositeStore();
  const room  = new MemoryTiddlerStore();
  store.addLayer({ bagId: BAG_IDS.room, store: room, writable: true });
  return store;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe("LarPeer — construction", () => {
  test("constructs with a CompositeStore and a peerId", () => {
    const store = makeStore();
    const peer  = new LarPeer({ peerId: "altar-fire", store });
    expect(peer.peerId).toBe("altar-fire");
    expect(peer.store).toBe(store);
  });

  test("vmPool starts null", () => {
    const peer = new LarPeer({ peerId: "p1", store: makeStore() });
    expect(peer.vmPool).toBeNull();
    expect(peer.ready).toBe(false);
  });

  test("attachVmPool makes peer ready", () => {
    const peer = new LarPeer({ peerId: "p1", store: makeStore() });
    peer.attachVmPool({ kind: "mock-pool" });
    expect(peer.vmPool).toEqual({ kind: "mock-pool" });
    expect(peer.ready).toBe(true);
  });

  test("dispose clears vmPool", () => {
    const peer = new LarPeer({ peerId: "p1", store: makeStore() });
    peer.attachVmPool("pool");
    peer.dispose();
    expect(peer.vmPool).toBeNull();
    expect(peer.ready).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Capability presets — symmetric node/browser/none
// ---------------------------------------------------------------------------

describe("LarPeer — capability presets", () => {
  test("PEER_CAPABILITIES_NODE: disk + relay + authoritativeReactions", () => {
    expect(PEER_CAPABILITIES_NODE.diskAccess).toBe(true);
    expect(PEER_CAPABILITIES_NODE.persistentRelay).toBe(true);
    expect(PEER_CAPABILITIES_NODE.authoritativeReactions).toBe(true);
    expect(PEER_CAPABILITIES_NODE.broadcastChannel).toBe(false);
  });

  test("PEER_CAPABILITIES_BROWSER: BC + no disk + no authoritativeReactions", () => {
    expect(PEER_CAPABILITIES_BROWSER.diskAccess).toBe(false);
    expect(PEER_CAPABILITIES_BROWSER.broadcastChannel).toBe(true);
    expect(PEER_CAPABILITIES_BROWSER.authoritativeReactions).toBe(false);
  });

  test("PEER_CAPABILITIES_NONE: all false", () => {
    for (const v of Object.values(PEER_CAPABILITIES_NONE)) {
      expect(v).toBe(false);
    }
  });

  test("peer applies capability overrides from options", () => {
    const peer = new LarPeer({
      peerId: "p",
      store:  makeStore(),
      capabilities: { diskAccess: true, authoritativeReactions: true },
    });
    expect(peer.capabilities.diskAccess).toBe(true);
    expect(peer.capabilities.broadcastChannel).toBe(false); // default
  });
});

// ---------------------------------------------------------------------------
// OpenIdentitySlot — DID-based identity (alpha open model)
// ---------------------------------------------------------------------------

describe("OpenIdentitySlot — DID shape", () => {
  test("DID encodes peerId into did:web:elyncia.app/peers/<id> namespace", () => {
    const slot = new OpenIdentitySlot("altar-fire");
    expect(slot.did).toContain("did:web:elyncia.app/peers/");
    expect(slot.did).toContain("altar-fire");
  });

  test("deriveActorId returns a UUID-formatted string (stable per peerId)", async () => {
    const slot = new OpenIdentitySlot("my-peer");
    const id1  = await slot.deriveActorId();
    const id2  = await slot.deriveActorId();
    // UUID format: 8-4-4-4-12 hex groups
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(id1).toBe(id2); // deterministic
  });

  test("different peerIds produce different actorIds", async () => {
    const a = await new OpenIdentitySlot("peer-a").deriveActorId();
    const b = await new OpenIdentitySlot("peer-b").deriveActorId();
    expect(a).not.toBe(b);
  });

  test("alpha open model: verifyCapability always returns true", async () => {
    const slot = new OpenIdentitySlot("any");
    expect(await slot.verifyCapability("automerge:xyz", "read")).toBe(true);
    expect(await slot.verifyCapability("automerge:xyz", "write")).toBe(true);
  });

  test("alpha open model: delegateCapability returns null token", async () => {
    const slot  = new OpenIdentitySlot("issuer");
    const token = await slot.delegateCapability("automerge:doc", "did:web:target", "read");
    expect(token).toBeNull();
  });

  test("peer gets identity slot from peerId when not provided", () => {
    const peer = new LarPeer({ peerId: "my-host", store: makeStore() });
    expect(peer.identity.did).toContain("my-host");
  });
});

// ---------------------------------------------------------------------------
// addProjection — wires to the composite store subscribe
// ---------------------------------------------------------------------------

describe("LarPeer — addProjection", () => {
  test("projection receives changes from the store", async () => {
    const room  = new MemoryTiddlerStore();
    const composite = new CompositeStore();
    composite.addLayer({ bagId: BAG_IDS.room, store: room, writable: true });
    const peer = new LarPeer({ peerId: "p", store: composite });

    const changes: LarTiddlerChange[] = [];
    const unsub = peer.addProjection({ onUriChanged: (c) => changes.push(c) });

    await room.put({ tiddler: { title: "lar:///test" } }, { kind: "crdt-remote", edgeIsland: "room" });
    unsub();

    expect(changes.some((c) => c.title === "lar:///test")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Operator-peer contract — shared browser/node factory surface
// ---------------------------------------------------------------------------

describe("OperatorPeer contract — shared open surface", () => {
  test("shared options carry host/wiki identity and optional VM factory", () => {
    const options: OperatorPeerOpenOptions = {
      hostId: "elyncia",
      wikiId: "altar-fire",
      recipeUri: "lar:///ha.ka.ba/@lararium/recipes/default",
    };

    expect(options.hostId).toBe("elyncia");
    expect(options.wikiId).toBe("altar-fire");
    expect(options.recipeUri).toContain("/recipes/default");
  });

  test("shared result surface exposes peer/repo/store/pool symmetry", () => {
    const peer = new LarPeer({ peerId: "p", store: makeStore() });
    const result: OperatorPeerOpenResult<LarPeer<"pool">, "pool", { kind: "repo" }, CompositeStore> = {
      peer,
      pool: "pool",
      repo: { kind: "repo" },
      store: peer.store as CompositeStore,
      catalogHandleUrl: "automerge:catalog",
      larariumDocUrl: "automerge:island",
      phase: "live",
    };

    expect(result.peer).toBe(peer);
    expect(result.store).toBe(peer.store);
    expect(result.phase).toBe("live");
  });
});
