/**
 * A boot that throws AFTER it stood a Repo, a relay adapter, a holder port or a daemon worker tears down what it stood
 * BEFORE the store lock goes back; and a boot that cannot tear down keeps the lock and says so by name. Otherwise a retry
 * opens a second Repo and a second adapter on the same IndexedDB store.
 */
import { describe, expect, test } from "vitest";
// `?raw` because this suite runs in a browser: the weld reads the boot's own source, never through `node:fs`.
import bootSrc from "../src/open-browser-vessel.ts?raw";
import { guardedBoot, BootTeardownRefusal, type BootHold } from "../src/guarded-boot.js";
import type { VesselLockHold } from "../src/vessel-lock.js";

function hold(log: string[]): BootHold {
  const lock: VesselLockHold = { name: "lares:vessel", held: true, release: async () => { log.push("lock released"); } };
  return { lock, stood: [] };
}

describe("a boot that throws after it stood things", () => {
  test("every stood thing comes down, newest first, BEFORE the lock is released", async () => {
    const log: string[] = [];
    const held = hold(log);
    await expect(guardedBoot(held, async () => {
      held.stood.push({ what: "repo", down: () => { log.push("repo down"); } });
      held.stood.push({ what: "relay adapter", down: async () => { log.push("adapter down"); } });
      held.stood.push({ what: "daemon worker", down: () => { log.push("daemon down"); } });
      throw new Error("the boot refused after the repo stood");
    })).rejects.toThrow("the boot refused after the repo stood");
    expect(log).toEqual(["daemon down", "adapter down", "repo down", "lock released"]);
    expect(held.stood).toEqual([]);
  });

  test("a thing that will not come down keeps the lock and refuses by name, the original fault beside it", async () => {
    const log: string[] = [];
    const held = hold(log);
    const err = await guardedBoot(held, async () => {
      held.stood.push({ what: "repo", down: () => { log.push("repo down"); } });
      held.stood.push({ what: "relay adapter", down: () => { throw new Error("socket stuck"); } });
      throw new Error("the original fault");
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BootTeardownRefusal);
    expect((err as BootTeardownRefusal).failed).toEqual(["relay adapter"]);
    expect(String((err as BootTeardownRefusal).cause)).toContain("the original fault");
    expect(log).toEqual(["repo down"]);                         // the rest still came down; the lock stayed held
    expect(log).not.toContain("lock released");
  });

  test("a boot that stands and returns keeps everything, lock included", async () => {
    const log: string[] = [];
    const held = hold(log);
    await expect(guardedBoot(held, async () => { held.stood.push({ what: "repo", down: () => { log.push("repo down"); } }); return "booted"; })).resolves.toBe("booted");
    expect(log).toEqual([]);
  });

  test("WELD: the browser boot registers what it stands and runs under the guard", () => {
    const src = bootSrc;
    expect(src).toMatch(/guardedBoot\(held,/);
    for (const what of ["repo", "relay adapter", "shared holder port", "daemon worker"]) expect(src, what).toContain(`what: "${what}"`);
  });
});
