/**
 * lease-frontier — the two verdicts a lease read can give, and the road it takes to give them.
 *
 *   ★ an empty, readable daemon layer reads epoch 0 (the founding epoch), never unavailable
 *   ★ slots present fold by MAX, over this group's prefix only, skipping malformed values
 *   CONTROLS — each reads UNAVAILABLE, never 0: no group pinned · no composite · the daemon layer absent ·
 *   a read that faults
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, leaseEpochSlotUri, type LarTiddlerStore } from "@lararium/mesh";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { readLeaseFrontier } from "../src/lease-frontier.js";

const GROUP = "ab".repeat(16);
const OTHER = "cd".repeat(16);
const origin = { kind: "test" } as never;

async function daemonComposite(slots: Array<[group: string, writer: string, value: string]> = []) {
  const composite = new CompositeStore();
  const store = new MemoryTiddlerStore(DAEMON_BAG_ID);
  composite.addLayer({ bagId: DAEMON_BAG_ID, store, writable: true });
  for (const [group, writer, value] of slots) {
    const title = leaseEpochSlotUri(group, writer);
    await store.put({ tiddler: { title, text: value }, meta: { authority: "test" } } as never, origin);
  }
  return composite;
}

describe("the lease frontier's two verdicts", () => {
  test("★ an empty, readable daemon layer reads epoch 0 ★", async () => {
    expect(await readLeaseFrontier(await daemonComposite(), GROUP)).toEqual({ kind: "epoch", n: 0 });
  });

  test("★ slots present fold by MAX over this group's prefix, skipping malformed values ★", async () => {
    const composite = await daemonComposite([
      [GROUP, "w1", "2"], [GROUP, "w2", "5"], [GROUP, "w3", "not-a-number"], [OTHER, "w4", "9"],
    ]);
    expect(await readLeaseFrontier(composite, GROUP)).toEqual({ kind: "epoch", n: 5 });
  });

  test("CONTROL — no group pinned reads UNAVAILABLE", async () => {
    expect((await readLeaseFrontier(await daemonComposite(), undefined)).kind).toBe("unavailable");
  });

  test("CONTROL — no composite reads UNAVAILABLE", async () => {
    expect((await readLeaseFrontier(null, GROUP)).kind).toBe("unavailable");
  });

  test("CONTROL — the daemon layer absent reads UNAVAILABLE, never 0", async () => {
    const composite = new CompositeStore();
    composite.addLayer({ bagId: "lar:///ha.ka.ba/bags/elsewhere", store: new MemoryTiddlerStore("x"), writable: true });
    const verdict = await readLeaseFrontier(composite, GROUP);
    expect(verdict.kind).toBe("unavailable");
    expect(verdict).toMatchObject({ why: expect.stringContaining("daemon layer is absent") });
  });

  test("CONTROL — a read that faults reads UNAVAILABLE, never 0", async () => {
    const faulting = {
      listVisible: async () => { throw new Error("replica torn"); },
      get: async () => null,
    } as unknown as LarTiddlerStore;
    const verdict = await readLeaseFrontier({ storeForBag: () => faulting }, GROUP);
    expect(verdict).toEqual({ kind: "unavailable", why: expect.stringContaining("replica torn") });
  });
});
