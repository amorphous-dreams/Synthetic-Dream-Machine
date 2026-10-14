/**
 * browser-walk.test.ts — a browser leaf walks under its own store and its own leaf, over REAL IndexedDB.
 *
 * Proven:
 *   · a carried invite is written to the vessel's own store before any dial, keyed by the hearth's gate key;
 *     the dial presents the TOKEN while the invite stands, and the GRANT once it has settled;
 *   · CONTROL: an invite for another gate key is kept under that key, never under the pinned one;
 *   · ONE HAND: an update reads, decides and writes in one transaction, so changes that start together both stand
 *     and one token leaves the wallet once; an update that declines or throws writes nothing;
 *   · the walker's leaf derives from its own persona root, per Nexus — one root, a different leaf in each Nexus;
 *   · RED: the retired newcomer-side burn store is gone from a fresh vessel; the walk store stands in its place.
 */
import { describe, test, expect, afterEach } from "vitest";
import {
  encodeInvite, takeInvite, walkArm, popInvite,
  type HostingGrant, type InviteToken,
} from "@lararium/mesh";
import { browserWalkStore, browserWalkLeaf } from "../src/browser-walk.js";
import { generateOrLoadBrowserPersonaRoot, openVesselIdb, WALK_STORE } from "../src/browser-vessel-identity.js";

let created = 0;
const opened = new Set<string>();
const idb = (): string => { const n = `lares:test-walk:${Date.now()}:${created++}`; opened.add(n); return n; };
afterEach(async () => {
  for (const name of opened) await new Promise<void>((r) => { const q = indexedDB.deleteDatabase(name); q.onsuccess = q.onerror = q.onblocked = () => r(); });
  opened.clear();
});

const GATE  = "ab".repeat(32);
const AID   = "nexus-" + "a".repeat(64);
const TOKEN: InviteToken = { purpose: "host-invite", n: "12".repeat(32), y: "34".repeat(64) };

describe("the browser walk", () => {
  test("the invite is kept before any dial; the token presents until the invite settles, then the grant", async () => {
    const name = idb();
    await generateOrLoadBrowserPersonaRoot(name, 0);
    const store = browserWalkStore(name);
    const carried = encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: TOKEN });
    const taken = await takeInvite(store, carried);
    expect(taken?.gatePubKey).toBe(GATE);
    expect((await store.read(GATE))?.invite).toBe(carried);
    const leaf = await browserWalkLeaf(name, AID, 0);
    expect(walkArm((await store.read(GATE))!, leaf)?.kind).toBe("token");
    const grant: HostingGrant = { nexusAid: AID, leaf: leaf.verifyingKey, epoch: "e".repeat(64), lineage: "d".repeat(64), survived: 0, from: "host", tag: "f".repeat(128) };
    await store.update(GATE, () => ({ nexusAid: AID, invite: carried, grant }));
    expect(walkArm((await store.read(GATE))!, leaf)?.kind).toBe("token");            // unsettled: the token still presents
    await store.update(GATE, () => ({ nexusAid: AID, grant }));
    expect(walkArm((await store.read(GATE))!, leaf)).toEqual({ kind: "grant", grant });
  });

  test("ONE HAND: two changes that start together both stand, and one token leaves the wallet once", async () => {
    const store = browserWalkStore(idb());
    const grant: HostingGrant = { nexusAid: AID, leaf: "ab".repeat(32), epoch: "e".repeat(64), lineage: "d".repeat(64), survived: 0, from: "host", tag: "f".repeat(128) };
    const token: InviteToken = { purpose: "walker-invite", n: "56".repeat(32), y: "78".repeat(64) };
    await store.update(GATE, () => ({ nexusAid: AID, wallet: [{ epoch: grant.epoch, token }] }));
    // A grant lands and two hand-outs start in the same turn: each update reads the record the one before it wrote.
    const [, first, second] = await Promise.all([
      store.update(GATE, (held) => ({ ...held!, grant })),
      popInvite(store, GATE),
      popInvite(store, GATE),
    ]);
    expect([first, second].filter((i) => i !== null)).toHaveLength(1);
    expect(await store.read(GATE)).toEqual({ nexusAid: AID, wallet: [], grant });
  });

  test("an update that declines writes nothing; one whose decision throws writes nothing and rejects with that error", async () => {
    const store = browserWalkStore(idb());
    expect(await store.update(GATE, (held) => { expect(held).toBeNull(); return null; })).toBeNull();
    expect(await store.read(GATE)).toBeNull();
    await store.update(GATE, () => ({ nexusAid: AID }));
    await expect(store.update(GATE, () => { throw new Error("the decision refused"); })).rejects.toThrow("the decision refused");
    expect(await store.read(GATE)).toEqual({ nexusAid: AID });
  });

  test("CONTROL: an invite for another hearth is kept under that hearth's key alone", async () => {
    const store = browserWalkStore(idb());
    const other = "cd".repeat(32);
    await takeInvite(store, encodeInvite({ nexusAid: AID, gatePubKey: other, token: TOKEN }));
    expect(await store.read(GATE)).toBeNull();
    expect((await store.read(other))?.nexusAid).toBe(AID);
  });

  test("one persona root, a different leaf in each Nexus", async () => {
    const name = idb();
    await generateOrLoadBrowserPersonaRoot(name, 0);
    const a = await browserWalkLeaf(name, AID, 0);
    const b = await browserWalkLeaf(name, "nexus-" + "b".repeat(64), 0);
    expect(a.verifyingKey).toMatch(/^[0-9a-f]{64}$/);
    expect(a.verifyingKey).not.toBe(b.verifyingKey);
    expect((await browserWalkLeaf(name, AID, 0)).verifyingKey).toBe(a.verifyingKey);
  });

  test("RED: the newcomer-side burn store is gone; the walk store stands in its place", async () => {
    const db = await openVesselIdb(idb());
    try {
      expect(db.objectStoreNames.contains("boot-invite-burned")).toBe(false);
      expect(db.objectStoreNames.contains(WALK_STORE)).toBe(true);
    } finally { db.close(); }
  });
});
