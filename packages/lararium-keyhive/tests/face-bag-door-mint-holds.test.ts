import { describe, expect, test } from "vitest";
import { InMemoryEventStore, KeyhiveProvider, makeFaceBagDoor } from "../src/index.js";
import type { BagDocLedger } from "../src/index.js";

/**
 * THE FACE BAG DOOR'S MINT HOLDS ACROSS BOOTS. A daemon's working layer mints through the door at every boot, and a
 * face that stands again must find the Document it minted, not mint another. With a ledger the door adopts the
 * recorded Document while the face still holds its hand, grants nothing a second time, and adds no event.
 */
const BAG = "lar:///k15.step2c/working";
const GROUP = "face-group-mint-holds";

async function stand(store: InMemoryEventStore, seed: number, archive?: Uint8Array): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(seed), eventStore: store, ...(archive ? { archiveBytes: archive } : {}) });
  await p.hydrateFromEventStore();
  return p;
}

async function runBoots(withLedger: boolean): Promise<{ ids: string[]; added: Array<Record<string, number>> }> {
  const store = new InMemoryEventStore();
  const rows = new Map<string, string>();
  const ledger: BagDocLedger = { get: async (b) => rows.get(b) ?? null, put: async (b, d) => { rows.set(b, d); } };
  // The face's audience: a second Individual whose card the face knows.
  const audienceStore = new InMemoryEventStore();
  const audience = await stand(audienceStore, 0x33);
  const card = await audience.contactCard();
  let archive: Uint8Array | undefined;
  const ids: string[] = [];
  const added: Array<Record<string, number>> = [];
  for (let boot = 0; boot < 3; boot += 1) {
    const count = async (): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      for (const r of await store.list()) out[r.variant] = (out[r.variant] ?? 0) + 1;
      return out;
    };
    const before = await count();
    const face = await stand(store, 0x5a, archive);
    await face.receiveContactCard(card);
    const audienceId = (await audience.vesselIdentifierHex());
    const door = makeFaceBagDoor({ face, groupId: audienceId, ...(withLedger ? { ledger } : {}) });
    ids.push((await door.mint(BAG, "admin")).docId);
    archive = await face.exportArchiveAfterTheCard();
    const after = await count();
    const delta: Record<string, number> = {};
    for (const v of new Set([...Object.keys(before), ...Object.keys(after)])) delta[v] = (after[v] ?? 0) - (before[v] ?? 0);
    added.push(delta);
    await face.dispose();
  }
  await audience.dispose();
  return { ids, added };
}

describe("the face bag door's mint across boots", () => {
  test("with a ledger the door keeps one Document and adds no delegation or CGKA event after boot one", { timeout: 120_000 }, async () => {
    const { ids, added } = await runBoots(true);
    expect(ids[1]).toEqual(ids[0]);
    expect(ids[2]).toEqual(ids[1]);
    for (const delta of added.slice(1)) {
      expect(delta["DELEGATED"] ?? 0).toBe(0);
      expect(delta["CGKA_OPERATION"] ?? 0).toBe(0);
    }
  });

  test("CONTROL: with no ledger the door mints a new Document at every boot and the events grow", { timeout: 120_000 }, async () => {
    const { ids, added } = await runBoots(false);
    expect(ids[1]).not.toEqual(ids[0]);
    expect(ids[2]).not.toEqual(ids[1]);
    for (const delta of added.slice(1)) expect(delta["DELEGATED"] ?? 0).toBeGreaterThan(0);
  });
});
