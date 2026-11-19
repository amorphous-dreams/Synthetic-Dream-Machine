/**
 * slot-wait-own-store — A SLOT THE ISLAND'S OWN STORE HOLDS NEVER READS AS PORT SILENCE WHILE THAT STORE STILL READS.
 *
 * An island's Repo reaches a slot document from its own store first, and asks the vessel over the sync port only once its
 * store has answered. Its store stands behind the rest guard (`islandRestGuard`): before it serves a byte of a document it
 * asks the vessel whether that document rests sealed there, and the vessel answers from its own rest, which may queue
 * behind a corpus load for seconds. While that read stands in flight the island's Repo sends nothing on the port, so the
 * vessel sends nothing back, and a wait that clocks port silence alone faults a document that sits in the island's own
 * store (`never arrived over syncPort`), the vessel never asked.
 *
 *   S1  RED: the island's own store holds the slot document, and the vessel answers its rest ask after the silence budget:
 *       the wait reads the document (the store's read in flight holds the silence clock). CONTROL beside it: the same store
 *       with a rest answer inside the budget reads the document.
 *   S2  A rest answer that never comes still ends the wait at the hard cap, and the outcome names the store read still in
 *       flight, so the fault names where the island waited rather than blaming the port.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed (V2, the island's own rest)
 */
import { describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { islandRestGuard, type Repo as RepoType, type StorageAdapterInterface } from "@lararium/mesh";
import { waitForSlotDocument, type SlotWaitBudgets } from "../src/slot-wait.js";
import { storeLiveness } from "../src/store-liveness.js";

// The tw5 package reaches the engine through mesh alone; the test borrows mesh's own copy of the Repo.
const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { storage: StorageAdapterInterface; network: []; peerId: string }) => RepoType;
type StorageKey = string[];
type Chunk = { key: StorageKey; data: Uint8Array | undefined };

function memoryAdapter(): StorageAdapterInterface {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> {
      return [...bytes].filter(([key]) => starts(key, prefix)).map(([key, data]) => ({ key: key.split("\u0000"), data: Uint8Array.from(data) }));
    },
    async removeRange(prefix) { for (const key of [...bytes.keys()]) if (starts(key, prefix)) bytes.delete(key); },
  };
}

const later = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const BUDGETS: SlotWaitBudgets = { silenceMs: 150, hardCapMs: 2_000, pollMs: 25 };

/** One island store holding a slot document, its rest ask answered after `answerMs` (never, with null). */
async function islandWith(answerMs: number | null): Promise<{ repo: RepoType; url: string; liveness: ReturnType<typeof storeLiveness>["liveness"] }> {
  const inner = memoryAdapter();
  const before = new Repo({ storage: inner, network: [], peerId: "island-before" });
  const doc = before.create<{ note?: string }>();
  doc.change((d) => { d.note = "the heron keeps the margin"; });
  await before.flush();
  await before.shutdown();
  const ask = (): Promise<boolean> => answerMs === null ? new Promise<boolean>(() => {}) : later(answerMs).then(() => false);
  const { storage, liveness } = storeLiveness(islandRestGuard(inner, ask), () => performance.now());
  const repo = new Repo({ storage, network: [], peerId: "island-after" });
  return { repo, url: doc.url, liveness };
}

function waitOn(island: Awaited<ReturnType<typeof islandWith>>) {
  // The kernel's wiring: the port's last inbound message (none here: the island asked the vessel nothing), and its own
  // store's reads.
  const started = performance.now();
  return waitForSlotDocument({
    find: () => island.repo.find(island.url as never),
    absence: (rejection) => rejection instanceof Error && /is unavailable/.test(rejection.message),
    peerCount: () => 0,
    now: () => performance.now(),
    lastHeard: () => started,
    store: () => island.liveness.reading(),
    sleep: later,
    defer: () => new Promise((resolve) => setImmediate(resolve)),
    budgets: BUDGETS,
  });
}

describe("a slot the island's own store holds never reads as port silence while that store still reads", () => {
  test("S1 RED: the rest answer lands past the silence budget and the wait reads the document; CONTROL: an answer inside the budget reads it", async () => {
    const quick = await islandWith(10);
    try {
      expect((await waitOn(quick)).outcome, "CONTROL: an answer inside the budget").toBe("ready");
    } finally { await quick.repo.shutdown(); }
    const slow = await islandWith(BUDGETS.silenceMs * 3);
    try {
      const out = await waitOn(slow);
      expect(out.outcome, "the store's read in flight holds the silence clock").toBe("ready");
    } finally { await slow.repo.shutdown(); }
  }, 30_000);

  test("S2: a rest answer that never comes ends the wait at the hard cap, naming the store read still in flight", async () => {
    const hung = await islandWith(null);
    try {
      const out = await waitOn(hung);
      expect(out.outcome).toBe("never-arrived");
      if (out.outcome !== "never-arrived") return;
      expect(out.elapsedMs, "the hard cap ends it, never the silence budget").toBeGreaterThanOrEqual(BUDGETS.hardCapMs);
      expect(out.storeReads, "the outcome names the read still in flight").toBeGreaterThan(0);
    } finally { void hung.repo.shutdown().catch(() => {}); }
  }, 30_000);
});
