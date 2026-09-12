/**
 * The single-owner law lit in the browser: one holder per vessel store, per origin.
 *
 * A second tab opening the same IndexedDB store stands a second holder over one repo and one OPFS CAS —
 * the collision face-join names for keyhive. The Web Locks API IS that law under another name ("there
 * can be only one exclusive holder"), so the door rides it: `ifAvailable` refuses LOUD with the holder
 * named, and `steal` never passes. A host without the API opens as before — a missing platform cap reads
 * as a FLOOR, never a throw.
 */
import { describe, expect, test } from "vitest";

import { holdVesselLock, vesselLockName, type LockHost } from "../src/vessel-lock.js";

describe("the vessel lock refuses a second holder, loud, naming the first", () => {
  test("against the LIVE browser: two holds on one store, the second refuses and names the holder", async () => {
    const idbName = `lares:vessel:test:${Date.now()}`;
    const first = await holdVesselLock(idbName);
    expect(first.held).toBe(true);
    try {
      await expect(holdVesselLock(idbName)).rejects.toThrow(/already held/);
      await expect(holdVesselLock(idbName)).rejects.toThrow(vesselLockName(idbName));
      // The refusal names the holder the platform reports, so a person knows WHICH tab to close.
      await expect(holdVesselLock(idbName)).rejects.toThrow(/held by/);
    } finally {
      await first.release();
    }
    // A released store opens again — the lock lives exactly as long as the holder.
    const again = await holdVesselLock(idbName);
    expect(again.held).toBe(true);
    await again.release();
  });

  test("two stores never collide — the lock keys on the store name", async () => {
    const a = await holdVesselLock("lares:vessel:test:a");
    const b = await holdVesselLock("lares:vessel:test:b");
    expect(a.held && b.held).toBe(true);
    await a.release(); await b.release();
  });

  test("a fake host: the request passes `ifAvailable`, never `steal`", async () => {
    const seen: Array<Record<string, unknown>> = [];
    const host: LockHost = {
      request: async (_name, opts, cb) => { seen.push(opts); return cb({ name: _name }); },
      query:   async () => ({ held: [] }),
    };
    const hold = await holdVesselLock("lares:vessel", host);
    expect(hold.held).toBe(true);
    expect(seen[0]).toEqual({ ifAvailable: true });
    expect(seen[0]).not.toHaveProperty("steal");
    await hold.release();
  });

  test("a fake host that reports the store held refuses and names the holder's client", async () => {
    const host: LockHost = {
      request: async (_name, _opts, cb) => cb(null),
      query:   async () => ({ held: [{ name: vesselLockName("lares:vessel"), mode: "exclusive", clientId: "tab-7" }] }),
    };
    await expect(holdVesselLock("lares:vessel", host)).rejects.toThrow(/tab-7/);
  });
});

describe("CONTROL — a host without Web Locks opens as today", () => {
  test("an absent API reads as a floor: the open proceeds, unheld, and release is a no-op", async () => {
    const hold = await holdVesselLock("lares:vessel", null);
    expect(hold.held).toBe(false);
    expect(hold.floor).toMatch(/no Web Locks/);
    await expect(hold.release()).resolves.toBeUndefined();
  });
});
