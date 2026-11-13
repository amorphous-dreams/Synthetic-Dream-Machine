import { describe, expect, test } from "vitest";
import { InMemoryEventStore, KeyhiveProvider } from "../src/index.js";
import type { BagDocLedger } from "../src/index.js";

const BAGS = [
  "lar:///k15.step2b/amber",
  "lar:///k15.step2b/blue",
  "lar:///k15.step2b/copper",
] as const;

type Counts = Record<string, number>;

function countVariants(records: readonly { variant: string }[]): Counts {
  const counts: Counts = {};
  for (const { variant } of records) counts[variant] = (counts[variant] ?? 0) + 1;
  return counts;
}

function delta(after: Counts, before: Counts): Counts {
  const result: Counts = {};
  for (const variant of new Set([...Object.keys(before), ...Object.keys(after)])) {
    result[variant] = (after[variant] ?? 0) - (before[variant] ?? 0);
  }
  return result;
}

async function stand(store: InMemoryEventStore, archiveBytes?: Uint8Array): Promise<KeyhiveProvider> {
  const provider = new KeyhiveProvider();
  await provider.init({
    seed: new Uint8Array(32).fill(0x5a),
    eventStore: store,
    ...(archiveBytes ? { archiveBytes } : {}),
  });
  await provider.hydrateFromEventStore();
  return provider;
}

async function eventCounts(store: InMemoryEventStore): Promise<Counts> {
  return countVariants(await store.list());
}

async function runPlainBoots(keepArchive: boolean): Promise<{ ids: string[][]; deltas: Counts[][] }> {
  const store = new InMemoryEventStore();
  let archive: Uint8Array | undefined;
  const ids: string[][] = [];
  const deltas: Counts[][] = [];

  for (let boot = 0; boot < 3; boot += 1) {
    const before = await eventCounts(store);
    const provider = await stand(store, boot === 0 || !keepArchive ? undefined : archive);
    const bootIds: string[] = [];
    for (const bag of BAGS) bootIds.push((await provider.registerBag(bag)).docId);
    ids.push(bootIds);
    archive = await provider.exportArchiveAfterTheCard();
    const after = await eventCounts(store);
    deltas.push([delta(after, before)]);
    await provider.dispose();
  }

  return { ids, deltas };
}

async function runLostArchiveLedgerControl(): Promise<{ ids: string[][]; deltas: Counts[] }> {
  const store = new InMemoryEventStore();
  const ledger = new Map<string, string>();
  let archive: Uint8Array | undefined;
  const ids: string[][] = [];
  const deltas: Counts[] = [];

  for (let boot = 0; boot < 3; boot += 1) {
    const before = await eventCounts(store);
    const provider = await stand(store, boot === 1 ? undefined : archive);
    const bootIds: string[] = [];
    for (const bag of BAGS) {
      const remembered = ledger.get(bag);
      if (remembered) provider.adoptBag(bag, remembered);
      if (remembered && await provider.holdsHand(bag)) {
        bootIds.push(remembered);
      } else {
        const fresh = await provider.registerBag(bag);
        ledger.set(bag, fresh.docId);
        bootIds.push(fresh.docId);
      }
    }
    ids.push(bootIds);
    archive = await provider.exportArchiveAfterTheCard();
    deltas.push(delta(await eventCounts(store), before));
    await provider.dispose();
  }

  return { ids, deltas };
}

describe("bag document bindings across boots", () => {
  test("durable registration keeps each document and adds no bag events after boot one", { timeout: 90_000 }, async () => {
    const { registerBagsDurably } = await import("../src/index.js");
    expect(typeof registerBagsDurably, "missing registerBagsDurably export").toBe("function");

    const store = new InMemoryEventStore();
    const rows = new Map<string, string>();
    const ledger: BagDocLedger = {
      get: async (bag) => rows.get(bag) ?? null,
      put: async (bag, docId) => { rows.set(bag, docId); },
    };
    let archive: Uint8Array | undefined;
    let firstIds: string[] | undefined;
    for (let boot = 0; boot < 3; boot += 1) {
      const before = await eventCounts(store);
      const provider = await stand(store, archive);
      await registerBagsDurably({ provider, bags: BAGS, ledger });
      const ids = BAGS.map((bag) => provider.docIdOfBag(bag)!);
      if (firstIds) expect(ids).toEqual(firstIds);
      else firstIds = ids;
      archive = await provider.exportArchiveAfterTheCard();
      const added = delta(await eventCounts(store), before);
      if (boot > 0) {
        expect(added.DELEGATED ?? 0).toBe(0);
        expect(added.CGKA_OPERATION ?? 0).toBe(0);
      }
      await provider.dispose();
    }
  });

  test("plain registerBag remints on each archived boot and grows delegation and CGKA events", { timeout: 90_000 }, async () => {
    const { ids, deltas } = await runPlainBoots(true);
    expect(ids[1]).not.toEqual(ids[0]);
    expect(ids[2]).not.toEqual(ids[1]);
    for (const bootDelta of deltas.slice(1)) {
      expect(bootDelta[0].DELEGATED ?? 0).toBeGreaterThan(0);
      expect(bootDelta[0].CGKA_OPERATION ?? 0).toBeGreaterThan(0);
    }
  });

  test("without the archive, the ledger keeps its binding and the replayed remint lands no event twice", { timeout: 90_000 }, async () => {
    const { ids, deltas } = await runLostArchiveLedgerControl();
    expect(ids[1]).toEqual(ids[0]);
    expect(ids[2]).toEqual(ids[1]);
    expect(deltas[1]!.DELEGATED ?? 0).toBe(0);
    expect(deltas[1]!.CGKA_OPERATION ?? 0).toBe(0);
    expect(deltas[2]!.DELEGATED ?? 0).toBe(0);
    expect(deltas[2]!.CGKA_OPERATION ?? 0).toBe(0);
  });
});
