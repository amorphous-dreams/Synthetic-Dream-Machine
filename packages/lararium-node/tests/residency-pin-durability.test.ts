/**
 * residency-pin-durability — an operator pin MUST survive a daemon restart.
 *
 * Canon: residency-tiers.mem#/pin-flag — "Pin is durable: pin state lives as tiddlers in the
 * admin doc and federates to operator devices via the existing admin-doc sync surface." The
 * bag-residency scout (2026-09-18) measured that claim as UNWIRED: `pinTiddlerUri` built the
 * URI shape but nothing ever wrote or read a pin tiddler — a `BagStowage.pin()` lived only in
 * the in-memory collector and vanished on restart.
 *
 * This proves the fix: `writePinTiddler` persists a pin as a tiddler under the daemon bag;
 * `removePinTiddler` hard-removes it on unpin; `replayPinsFromDaemonDoc` — called at boot,
 * BEFORE the sweeper starts (vessel-residency-wiring.ts, open-node-vessel.ts /
 * open-browser-vessel.ts) — re-pins every surviving tiddler into a FRESH `BagStowage`, so a
 * restart (modeled here as a brand-new collector reading the SAME daemon doc) recovers the pin.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-tiers
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { BagStowage, emptyLarDoc, type LarDoc } from "@lararium/mesh";
import {
  writePinTiddler, removePinTiddler, replayPinsFromDaemonDoc,
} from "@lararium/tw5";

const BAG_URL = "automerge:pin-durability-fixture";

describe("pin durability — survives a simulated daemon restart", () => {
  test("a pin written to the daemon doc replays into a fresh BagStowage", async () => {
    const repo         = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());

    // Boot #1 — operator pins a bag. The daemon-side writer persists it durably.
    const bootOne = new BagStowage();
    await bootOne.pin(BAG_URL, "operator:keep-hot");
    writePinTiddler(daemonHandle, BAG_URL, "operator:keep-hot");
    expect(bootOne.isPinned(BAG_URL)).toBe(true);

    // "Restart" — a brand-new collector, no in-memory state at all, reading the SAME
    // daemon doc. Nothing survives except what the writer persisted.
    const bootTwo = new BagStowage();
    expect(bootTwo.isPinned(BAG_URL)).toBe(false);   // sanity: truly fresh
    await replayPinsFromDaemonDoc(daemonHandle, bootTwo);

    expect(bootTwo.isPinned(BAG_URL)).toBe(true);
    expect(bootTwo.tier(BAG_URL)).toBe("wela");
  });

  test("unpin hard-removes the admin-doc tiddler — a later restart does not resurrect it", async () => {
    const repo         = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());

    const bootOne = new BagStowage();
    await bootOne.pin(BAG_URL, "operator:keep-hot");
    writePinTiddler(daemonHandle, BAG_URL, "operator:keep-hot");

    bootOne.unpin(BAG_URL);
    removePinTiddler(daemonHandle, BAG_URL);

    const bootTwo = new BagStowage();
    await replayPinsFromDaemonDoc(daemonHandle, bootTwo);
    expect(bootTwo.isPinned(BAG_URL)).toBe(false);
    expect(bootTwo.has(BAG_URL)).toBe(false);   // never even registered — no ghost anu entry
  });

  test("replay is idempotent — running it twice pins once, no double-hydrate surprise", async () => {
    const repo         = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    writePinTiddler(daemonHandle, BAG_URL, "operator:keep-hot");

    const residency = new BagStowage();
    await replayPinsFromDaemonDoc(daemonHandle, residency);
    await replayPinsFromDaemonDoc(daemonHandle, residency);
    expect(residency.isPinned(BAG_URL)).toBe(true);
    expect(residency.stats().pinned).toEqual([BAG_URL]);
  });
});
