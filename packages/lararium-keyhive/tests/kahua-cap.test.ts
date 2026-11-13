/**
 * kahua-cap — the lōkahi cap: the face's group holds the kahua stage bag in Keyhive's plane, apart from any lift record.
 *
 * RED: a presenter outside the face's group holds no cap, and an unseated face answers none; CONTROL: the face's group
 * member holds it, and a second ask mints nothing new. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { KAHUA_BAG } from "@lararium/mesh";
import { InMemoryEventStore, KeyhiveProvider, makeFaceBagDoor } from "../src/index.js";
import { answerKahuaCap } from "../src/kahua-cap.js";

async function stand(store: InMemoryEventStore, seed: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(seed), eventStore: store });
  await p.hydrateFromEventStore();
  return p;
}

describe("the lōkahi cap on the kahua stage", () => {
  test("RED: a stranger and an unseated face hold no cap; CONTROL: the face's group holds it, idempotently", { timeout: 120_000 }, async () => {
    const store = new InMemoryEventStore();
    const face = await stand(store, 0x5a), member = await stand(new InMemoryEventStore(), 0x33), stranger = await stand(new InMemoryEventStore(), 0x44);
    await face.receiveContactCard(await member.contactCard());
    const group = await member.vesselIdentifierHex(), strangerId = await stranger.vesselIdentifierHex();
    const rows = new Map<string, string>();
    const door = makeFaceBagDoor({ face, groupId: group, ledger: { get: async (b) => rows.get(b) ?? null, put: async (b, d) => { rows.set(b, d); } } });
    const verify = (args: Parameters<KeyhiveProvider["verify"]>[0]) => face.verify(args);
    expect(await answerKahuaCap({ door: null, verify, presenter: group })).toMatchObject({ held: false });
    expect(await answerKahuaCap({ door, verify, presenter: strangerId, ensure: true })).toMatchObject({ held: false });
    expect(await answerKahuaCap({ door, verify, presenter: group, ensure: true })).toEqual({ held: true });
    const events = (await store.list()).length;
    expect(await answerKahuaCap({ door, verify, presenter: group, ensure: true })).toEqual({ held: true });
    expect((await store.list()).length).toBe(events);
    expect(rows.has(KAHUA_BAG)).toBe(true);
    for (const p of [face, member, stranger]) await p.dispose();
  });

  test("RED (security read M2): a read verifies before it mints and writes nothing; only an ensure from a write path mints, and only once", { timeout: 120_000 }, async () => {
    const store = new InMemoryEventStore();
    const face = await stand(store, 0x5b), member = await stand(new InMemoryEventStore(), 0x34);
    await face.receiveContactCard(await member.contactCard());
    const group = await member.vesselIdentifierHex();
    const rows = new Map<string, string>();
    const door = makeFaceBagDoor({ face, groupId: group, ledger: { get: async (b) => rows.get(b) ?? null, put: async (b, d) => { rows.set(b, d); } } });
    const verify = (args: Parameters<KeyhiveProvider["verify"]>[0]) => face.verify(args);
    const before = (await store.list()).length;
    expect(await answerKahuaCap({ door, verify, presenter: group })).toMatchObject({ held: false });
    expect((await store.list()).length, "a read wrote a Keyhive event").toBe(before);
    expect(rows.has(KAHUA_BAG), "a read wrote the ledger row").toBe(false);
    expect(await answerKahuaCap({ door, verify, presenter: group, ensure: true })).toEqual({ held: true });
    const minted = (await store.list()).length;
    expect(minted).toBeGreaterThan(before);
    expect(await answerKahuaCap({ door, verify, presenter: group, ensure: true })).toEqual({ held: true });
    expect((await store.list()).length, "a held cap minted again").toBe(minted);
    expect(await answerKahuaCap({ door, verify, presenter: group })).toEqual({ held: true });
    for (const p of [face, member]) await p.dispose();
  });
});
