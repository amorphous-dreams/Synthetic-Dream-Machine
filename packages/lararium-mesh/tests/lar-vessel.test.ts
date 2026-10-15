/**
 * LarVessel — causal island vessel contracts.
 *
 * LarVessel holds no content truth. It receives the assembled CompositeStore
 * (system → corpus:* → wiki → draft) from the factory. Relay and browser
 * vessels share the same class — capability presets encode the environmental
 * difference.
 *
 * Meme: lar:///ha.ka.ba/lares/api/lararium/lar-vessel
 */

import { describe, test, expect } from "vitest";
import {
  LarVessel,
  LAR_VESSEL_CAPABILITIES_NODE,
  LAR_VESSEL_CAPABILITIES_BROWSER,
  LAR_VESSEL_CAPABILITIES_NONE,
  type LarariumVesselOptions,
  type LarariumVesselResult,
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
  const wiki  = new MemoryTiddlerStore();
  store.addLayer({ bagId: BAG_IDS.lararium, store: wiki, writable: true });
  return store;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe("LarVessel — construction", () => {
  test("constructs with a CompositeStore and a vesselId", () => {
    const store = makeStore();
    const vessel  = new LarVessel({ vesselId: "test-wiki", store });
    expect(vessel.vesselId).toBe("test-wiki");
    expect(vessel.store).toBe(store);
  });

  test("vmPool starts null", () => {
    const vessel = new LarVessel({ vesselId: "p1", store: makeStore() });
    expect(vessel.vmPool).toBeNull();
    expect(vessel.ready).toBe(false);
  });

  test("attachVmPool makes vessel ready", () => {
    const vessel = new LarVessel({ vesselId: "p1", store: makeStore() });
    vessel.attachVmPool({ kind: "mock-pool" });
    expect(vessel.vmPool).toEqual({ kind: "mock-pool" });
    expect(vessel.ready).toBe(true);
  });

  test("dispose clears vmPool", () => {
    const vessel = new LarVessel({ vesselId: "p1", store: makeStore() });
    vessel.attachVmPool("pool");
    vessel.dispose();
    expect(vessel.vmPool).toBeNull();
    expect(vessel.ready).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Capability presets — symmetric node/browser/none
// ---------------------------------------------------------------------------

describe("LarVessel — capability presets", () => {
  test("LAR_VESSEL_CAPABILITIES_NODE: disk + relay + hostfulReactions", () => {
    expect(LAR_VESSEL_CAPABILITIES_NODE.diskAccess).toBe(true);
    expect(LAR_VESSEL_CAPABILITIES_NODE.persistentRelay).toBe(true);
    expect(LAR_VESSEL_CAPABILITIES_NODE.hostfulReactions).toBe(true);
    expect(LAR_VESSEL_CAPABILITIES_NODE.broadcastChannel).toBe(false);
  });

  test("LAR_VESSEL_CAPABILITIES_BROWSER: BC + no disk + no hostfulReactions", () => {
    expect(LAR_VESSEL_CAPABILITIES_BROWSER.diskAccess).toBe(false);
    expect(LAR_VESSEL_CAPABILITIES_BROWSER.broadcastChannel).toBe(true);
    expect(LAR_VESSEL_CAPABILITIES_BROWSER.hostfulReactions).toBe(false);
  });

  test("LAR_VESSEL_CAPABILITIES_NONE: all false", () => {
    for (const v of Object.values(LAR_VESSEL_CAPABILITIES_NONE)) {
      expect(v).toBe(false);
    }
  });

  test("vessel applies capability overrides from options", () => {
    const vessel = new LarVessel({
      vesselId: "p",
      store:  makeStore(),
      capabilities: { diskAccess: true, hostfulReactions: true },
    });
    expect(vessel.capabilities.diskAccess).toBe(true);
    expect(vessel.capabilities.broadcastChannel).toBe(false); // default
  });
});

// ---------------------------------------------------------------------------
// THE RETIRED SLOT — a vessel that names none now CARRIES none (2026-09-13)
// ---------------------------------------------------------------------------

describe("the identity slot — no default, and no allow-all standing in for one", () => {
  test("a vessel given no slot carries null, never a slot that grants everything", () => {
    const vessel = new LarVessel({ vesselId: "my-host", store: makeStore() });
    expect(vessel.identity).toBeNull();
  });
  test("a vessel given a slot carries exactly that one", async () => {
    const slot = {
      did: "did:web:example/vessels/named",
      deriveActorId: async () => "00000000-0000-4000-8000-000000000000",
      verifyCapability: async () => false,
      delegateCapability: async () => null,
      verifyDelegation: async () => false,
    };
    const vessel = new LarVessel({ vesselId: "named", store: makeStore(), identity: slot });
    expect(vessel.identity).toBe(slot);
    // CONTROL: the slot the caller handed in answers for itself — nothing wraps or widens it.
    expect(await vessel.identity!.verifyCapability("automerge:xyz", "read")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addProjection — wires to the composite store subscribe
// ---------------------------------------------------------------------------

describe("LarVessel — addProjection", () => {
  test("projection receives changes from the store", async () => {
    const wiki  = new MemoryTiddlerStore();
    const composite = new CompositeStore();
    composite.addLayer({ bagId: BAG_IDS.lararium, store: wiki, writable: true });
    const vessel = new LarVessel({ vesselId: "p", store: composite });

    const changes: LarTiddlerChange[] = [];
    const unsub = vessel.addProjection({ onUriChanged: (c) => changes.push(c) });

    await wiki.put({ tiddler: { title: "lar:///test" } }, { kind: "crdt-remote", edgeIsland: "wiki" });
    unsub();

    expect(changes.some((c) => c.title === "lar:///test")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lararium vessel contract — shared browser/node open surface
// ---------------------------------------------------------------------------

describe("lararium-vessel contract — shared boot surface", () => {
  test("shared options carry host/wiki identity", () => {
    const options: LarariumVesselOptions = {
      hostId: "elyncia",
      wikiId: "test-wiki",
    };

    expect(options.hostId).toBe("elyncia");
    expect(options.wikiId).toBe("test-wiki");
  });

  test("shared result surface exposes vessel/repo/store/pool symmetry", () => {
    const vessel = new LarVessel({ vesselId: "p", store: makeStore() });
    const result: LarariumVesselResult<LarVessel<"pool">, "pool", { kind: "repo" }, CompositeStore> = {
      vessel,
      pool: "pool",
      repo: { kind: "repo" },
      store: vessel.store as CompositeStore,
      catalogHandleUrl: "automerge:catalog",
      larariumDocUrl: "automerge:island",
      phase: "live",
    };

    expect(result.vessel).toBe(vessel);
    expect(result.store).toBe(vessel.store);
    expect(result.phase).toBe("live");
  });
});
