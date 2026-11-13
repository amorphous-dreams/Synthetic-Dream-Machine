/**
 * A boot that throws gives the store lock back — a `sealed-locked` (or any refused) boot retries in the same page.
 * The lock host is injected (`opts.locks`); the boot reaches the lock, then dies on an engine whose IndexedDB the
 * vector swaps out. The page's `indexedDB` is a getter, so the swap redefines the property and restores its descriptor. The fake host mirrors the platform: a lock held until its callback's promise settles.
 */
import { describe, expect, test } from "vitest";
import { openBrowserVessel } from "../src/open-browser-vessel.js";
import { holdVesselLock, type LockHost } from "../src/vessel-lock.js";
import { BootTeardownRefusal } from "../src/guarded-boot.js";

function lockHost(): { host: LockHost; held: Set<string>; requests: string[] } {
  const held = new Set<string>();
  const requests: string[] = [];
  const host: LockHost = {
    request: async (name, _opts, cb) => {
      requests.push(name);
      if (held.has(name)) return cb(null);
      held.add(name);
      try { return await cb({ name }); } finally { held.delete(name); }
    },
    query: async () => ({ held: [...held].map((name) => ({ name, clientId: "c1", mode: "exclusive" })) }),
  };
  return { host, held, requests };
}

/** Run `body` with `globalThis.indexedDB` read as `value` (or absent), then restore the page's own descriptor. */
async function withIndexedDB<T>(value: unknown, body: () => Promise<T>): Promise<T> {
  const owner = Object.hasOwn(globalThis, "indexedDB") ? globalThis : Object.getPrototypeOf(globalThis);
  const prior = Object.getOwnPropertyDescriptor(owner, "indexedDB");
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, get: () => value });
  try { return await body(); } finally {
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
    if (prior !== undefined && owner === globalThis) Object.defineProperty(globalThis, "indexedDB", prior);
  }
}

describe("openBrowserVessel and the store lock when the boot throws", () => {
  test("a boot that stood a Repo it cannot take down KEEPS the lock and refuses by name", async () => {
    const { host, held, requests } = lockHost();
    const idbName = "lares:vessel:test:release";
    // The engine has no working IndexedDB: the boot takes the lock, stands a Repo over a store that never opens, and dies
    // after it. That Repo cannot flush, so it cannot come down inside its budget.
    // The Repo's store open never settles, so that Repo cannot flush or close; the vessel's own key store is refused on
    // a later tick, so the boot dies after the Repo stood. (A Repo whose store REFUSED closes cleanly: it is the
    // open that never answers that cannot come down.)
    // The boot reads the vessel's key store through the page's real engine until its Repo opens its own store; every key-store open after that is refused.
    const realEngine = globalThis.indexedDB;
    let repoStood = false;
    const refusingEngine = {
      open: (name: string, version?: number) => {
        if (name.endsWith(":repo")) repoStood = true;
        else if (!repoStood) return realEngine.open(name, version);
        const req: { error: DOMException; onerror?: (() => void) | null } = { error: new DOMException("no engine", "UnknownError") };
        if (!name.endsWith(":repo")) setTimeout(() => req.onerror?.(), 0);
        return req;
      },
    };
    const mute = (event: PromiseRejectionEvent): void => { event.preventDefault(); };
    globalThis.addEventListener("unhandledrejection", mute);
    let err: unknown;
    try {
      err = await withIndexedDB(refusingEngine, () =>
        openBrowserVessel({ wikiId: "w", idbName, locks: host, teardownBudgetMs: 50 } as never).catch((e: unknown) => e));
    } finally { await new Promise((r) => setTimeout(r, 20)); globalThis.removeEventListener("unhandledrejection", mute); }
    expect(err).toBeInstanceOf(BootTeardownRefusal);
    expect((err as BootTeardownRefusal).failed).toContain("repo");
    expect(requests.length).toBeGreaterThan(0);               // the boot DID take the lock (not a vacuous throw)
    expect(held.size).toBe(1);                                 // and KEPT it: a retry cannot open a second Repo over the store
  });

  test("a boot that dies before it stands anything gives the lock back, and the same store holds again", async () => {
    const { host, held } = lockHost();
    const idbName = "lares:vessel:test:release-early";
    // No `indexedDB` at all: the boot dies before any Repo stands.
    // The storage adapter opens its store off the constructor; with no engine it rejects a promise nobody holds.
    const mute = (event: PromiseRejectionEvent): void => { event.preventDefault(); };
    globalThis.addEventListener("unhandledrejection", mute);
    try {
      await withIndexedDB(undefined, () =>
        expect(openBrowserVessel({ wikiId: "w", idbName, locks: host, teardownBudgetMs: 50 } as never)).rejects.toThrow());
    } finally { await new Promise((r) => setTimeout(r, 20)); globalThis.removeEventListener("unhandledrejection", mute); }
    expect(held.size).toBe(0);
    const again = await holdVesselLock(idbName, host);
    expect(again.held).toBe(true);
    await again.release();
  });
});
