/**
 * kernel-absent-store-relays — a manifest that names no store stands a relay-only Repo on every platform.
 *
 * The vessel's Repo holds the one store. A wiki island's manifest names none, and the kernel asks its host for no
 * storage adapter then, whatever the host would offer (the browser shore once opened a store per wiki by default). Only
 * a manifest that names a store (the daemon island's) reaches the host's storage.
 *
 *   K1  a manifest naming no store: the host's storage is never asked.
 *       control: a manifest naming a store asks the host once, for that store.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/sovereign-kernel
 */
import { describe, expect, test } from "vitest";
import { MessageChannel } from "worker_threads";
import { mkManifest, mkTeardown, type IslandMsg_Manifest, type IslandToVesselMsg } from "@lararium/mesh";
import { runSovereignKernel, type IslandHostShore } from "../src/sovereign-kernel.js";
import type { IslandBehavior } from "../src/island-context.js";

const WIKI = "lar:///ha.ka.ba/bags/test/wiki";

async function mountOnce(storage: IslandMsg_Manifest["storage"] | undefined): Promise<Array<IslandMsg_Manifest["storage"]>> {
  const asked: Array<IslandMsg_Manifest["storage"]> = [];
  let deliver: ((raw: unknown) => void) | null = null;
  let heard!: () => void;
  const faulted = new Promise<void>((r) => { heard = r; });
  let acked!: () => void;
  const ack = new Promise<void>((r) => { acked = r; });
  const host: IslandHostShore = {
    post: (msg: IslandToVesselMsg) => { if (msg.type === "fault") heard(); if (msg.type === "teardown:ack") acked(); },
    listen: (h) => { deliver = h; },
    storage: (msg) => { asked.push(msg.storage); return undefined; },
  };
  const behavior: IslandBehavior = { onEa: async () => {}, onSignal: () => false, onHooAnu: async () => {} };
  runSovereignKernel(host, behavior, { breathEveryMs: 1_000 });
  const { port1, port2 } = new MessageChannel();
  // An island slot the Repo refuses at once: the mount faults, after its Repo stood.
  deliver!(mkManifest(WIKI, port2 as unknown as IslandMsg_Manifest["syncPort"], { wikiSlug: "test" }, { islandUrl: "automerge:bogus-slot-url" }, null,
    storage ? { storage } : {}));
  await faulted;
  deliver!(mkTeardown());
  await ack;
  port1.close();
  port2.close();
  return asked;
}

describe("a manifest that names no store stands a relay-only Repo", () => {
  test("K1 — no store named: the host's storage is never asked; a store named: asked once", async () => {
    expect(await mountOnce(undefined)).toEqual([]);
    expect(await mountOnce({ type: "nodefs", dir: "/nowhere/daemon" })).toEqual([{ type: "nodefs", dir: "/nowhere/daemon" }]);
  });
});
