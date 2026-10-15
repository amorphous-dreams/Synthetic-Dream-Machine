/**
 * kernel-teardown-closes-storage — an island's storage adapter closes BEFORE the island acks its teardown.
 *
 * The vessel terminates an island's worker once it hears `teardown:ack`. A Repo that still holds an open storage
 * adapter at that moment can start one more debounced save after the flush (a sync arrival between the flush and the
 * terminate), and the terminate cuts it. So the kernel shuts its Repo down, which closes the adapter, and only then
 * acks; any later save reads as late and lands no byte.
 *
 *   T1  RED: the ack waits on the adapter's close. The adapter's close holds until the test releases it (a
 *       handshake, never a timer): no `teardown:ack` posts while it holds; one posts once it returns.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/sovereign-kernel
 */
import { describe, expect, test } from "vitest";
import { MessageChannel } from "worker_threads";
import { mkManifest, mkTeardown, type IslandMsg_Manifest, type IslandToVesselMsg } from "@lararium/mesh";
import { runSovereignKernel, type IslandHostShore } from "../src/sovereign-kernel.js";
import type { IslandBehavior } from "../src/island-context.js";

const WIKI = "lar:///ha.ka.ba/bags/test/wiki";

/** A storage adapter in memory whose `close` holds until released, and says when it began. */
function heldStorage(): { adapter: Record<string, unknown>; closing: Promise<void>; release: () => void } {
  const rows = new Map<string, Uint8Array>();
  const key = (k: readonly string[]): string => k.join("/");
  let began!: () => void;
  const closing = new Promise<void>((r) => { began = r; });
  let release!: () => void;
  const released = new Promise<void>((r) => { release = r; });
  const adapter = {
    load: async (k: string[]) => rows.get(key(k)),
    save: async (k: string[], v: Uint8Array) => { rows.set(key(k), v); },
    remove: async (k: string[]) => { rows.delete(key(k)); },
    loadRange: async (p: string[]) => [...rows].filter(([k]) => k.startsWith(key(p))).map(([k, data]) => ({ key: k.split("/"), data })),
    removeRange: async (p: string[]) => { for (const k of [...rows.keys()]) if (k.startsWith(key(p))) rows.delete(k); },
    close: async () => { began(); await released; },
  };
  return { adapter, closing, release };
}

describe("the island's storage closes before its teardown ack", () => {
  test("T1 — RED: no ack posts while the adapter's close holds; one posts once it returns", async () => {
    const posted: IslandToVesselMsg[] = [];
    let deliver: ((raw: unknown) => void) | null = null;
    const storage = heldStorage();
    let heardAck!: () => void;
    const acked = new Promise<void>((r) => { heardAck = r; });
    let heardFault!: () => void;
    const faulted = new Promise<void>((r) => { heardFault = r; });
    const host: IslandHostShore = {
      post: (msg) => {
        posted.push(msg);
        if (msg.type === "teardown:ack") heardAck();
        if (msg.type === "fault") heardFault();
      },
      listen: (h) => { deliver = h; },
      storage: () => storage.adapter as unknown as ReturnType<IslandHostShore["storage"]>,
    };
    const behavior: IslandBehavior = { onEa: async () => {}, onSignal: () => false, onHooAnu: async () => {} };
    runSovereignKernel(host, behavior, { breathEveryMs: 1_000 });

    // A manifest whose island slot never resolves: the mount faults, and its Repo stands over the held storage.
    const { port1, port2 } = new MessageChannel();
    deliver!(mkManifest(WIKI, port2 as unknown as IslandMsg_Manifest["syncPort"], { wikiSlug: "test" }, { islandUrl: "automerge:bogus-slot-url" }, null));
    await faulted;

    deliver!(mkTeardown());
    await storage.closing;                                                   // the kernel reached the adapter's close
    expect(posted.some((m) => m.type === "teardown:ack")).toBe(false);       // RED today: the ack already posted
    storage.release();
    await acked;
    expect(posted.filter((m) => m.type === "teardown:ack")).toHaveLength(1);
    port1.close();
    port2.close();
  });
});
