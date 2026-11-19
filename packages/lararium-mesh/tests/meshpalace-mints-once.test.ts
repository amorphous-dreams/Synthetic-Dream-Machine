/**
 * A COMPOSE MINTS NOTHING IT CANNOT FIND AGAIN: the meshpalace FLOW-map.
 *
 * The meshpalace cap stands the vessel's own public FLOW-map (one document holding its `dial` and `routes` rows). A cap
 * that mints a fresh document at every compose, with no pointer it can read back, leaves one orphan per boot in the root
 * store: the operator's house held 79 of them on 2026-11-19. The map's address derives from the vessel's own key (the
 * house's `deterministicDocUrl` road, the one `edgeLedgerDocUrl` takes for a vessel's own ledger), so every compose of one
 * vessel finds the one map, and two vessels never share one.
 */
import { describe, test, expect } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { composeVessel, type CapModule } from "../src/cap-compose.js";
import { meshPalaceCap, CARRIAGE_CAP, type MeshPalaceComponent } from "../src/carriage-caps.js";
import { CompositeStore } from "../src/composite-store.js";
import { dialUri, routeUri, type DialEntry } from "../src/mesh-palace.js";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);
const SEED: readonly DialEntry[] = [{ bearing: "lar:///ha.ka.ba/bags/oracle/node", verifyingKeyHex: KEY_A, endpoint: "http://127.0.0.1:1", scale: "dreamnet" }];
const COORD = { r: 1, theta: 0.5 };

const substrate = (): CapModule => ({ id: "substrate", requires: [], build: () => ({ composite: new CompositeStore() }) });

async function composeMap(repo: Repo, vesselKey: string): Promise<MeshPalaceComponent> {
  const v = await composeVessel([substrate(), meshPalaceCap({ repo, vesselKey, seed: SEED, selfCoord: COORD })]);
  return v.get<MeshPalaceComponent>(CARRIAGE_CAP.meshpalace)!;
}

function memoryAdapter(): StorageAdapterInterface & { readonly bytes: Map<string, Uint8Array> } {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    bytes,
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => starts(k, prefix)).map(([k, data]) => ({ key: k.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix) { for (const k of [...bytes.keys()]) if (starts(k, prefix)) bytes.delete(k); },
  };
}

/** The documents a store rests: the first segment of every chunk key, the adapter's own id aside. */
const restedDocs = (bytes: Map<string, Uint8Array>): Set<string> =>
  new Set([...bytes.keys()].map((k) => k.split("\u0000")[0]!).filter((id) => id !== "storage-adapter-id"));

describe("the meshpalace cap mints its map once", () => {
  test("two composes over one Repo stand the one map", { timeout: 15_000 }, async () => {
    const repo = new Repo({ sharePolicy: async () => false });
    const first = await composeMap(repo, KEY_A);
    const second = await composeMap(repo, KEY_A);
    expect(second.handle.url).toBe(first.handle.url);
    await repo.shutdown();
  });

  test("a second boot over the same store finds the map the first rested, and the store holds one document", { timeout: 15_000 }, async () => {
    const adapter = memoryAdapter();
    const boot1 = new Repo({ storage: adapter, sharePolicy: async () => false });
    const first = await composeMap(boot1, KEY_A);
    await boot1.flush();
    await boot1.shutdown();
    expect(restedDocs(adapter.bytes).size).toBe(1);

    const boot2 = new Repo({ storage: adapter, sharePolicy: async () => false });
    const second = await composeMap(boot2, KEY_A);
    await boot2.flush();
    expect(second.handle.url).toBe(first.handle.url);
    expect(restedDocs(adapter.bytes).size, "a second compose rests no second map").toBe(1);
    const tiddlers = Object.keys(second.handle.doc()?.tiddlers ?? {}).sort();
    expect(tiddlers).toEqual([dialUri(SEED[0]!.bearing), routeUri(SEED[0]!.bearing)].sort());
    await boot2.shutdown();
  });

  test("two vessels' maps stand apart: the address follows the vessel's own key", { timeout: 15_000 }, async () => {
    const repo = new Repo({ sharePolicy: async () => false });
    const a = await composeMap(repo, KEY_A);
    const b = await composeMap(repo, KEY_B);
    expect(b.handle.url).not.toBe(a.handle.url);
    await repo.shutdown();
  });
});
